export const SCHEMA_VERSION = 1;

export const EMPTY_STATE = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    scene: {
        location: '',
        time: '',
        atmosphere: '',
    },
    npcDatabase: {},
    activeNpcKeys: [],
    updatedAt: 0,
});

const RELATIONSHIP_KEYS = ['favor', 'trust', 'guard', 'interest', 'stress'];

export function normalizeName(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase()
        .replace(/[\s·•・._'"“”‘’`~!！?？,，。:：;；()（）[\]【】{}<>《》-]+/gu, '');
}

export function clampNumber(value, min = 0, max = 100, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).replace(/\0/g, '').trim();
    return text || fallback;
}

function cleanTags(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(item => cleanText(item)).filter(Boolean))].slice(0, 5);
}

function extractJsonText(value) {
    const source = String(value ?? '').trim();
    const unfenced = source
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

    if (unfenced.startsWith('{') && unfenced.endsWith('}')) return unfenced;

    const start = unfenced.indexOf('{');
    if (start < 0) return unfenced;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < unfenced.length; index += 1) {
        const character = unfenced[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (character === '\\' && inString) {
            escaped = true;
            continue;
        }
        if (character === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (character === '{') depth += 1;
        if (character === '}') {
            depth -= 1;
            if (depth === 0) return unfenced.slice(start, index + 1);
        }
    }
    return unfenced;
}

export function parseTheaterResponse(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    const text = extractJsonText(value);
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('模型没有返回有效的 JSON。', { cause: error });
    }
}

function sanitizeRelationship(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => [key, clampNumber(source[key], 0, 100, 50)]));
}

function sanitizeCharacter(value) {
    const source = value && typeof value === 'object' ? value : {};
    const status = source.status && typeof source.status === 'object' ? source.status : {};
    const mind = source.mind && typeof source.mind === 'object' ? source.mind : {};
    const diary = source.diary && typeof source.diary === 'object' ? source.diary : {};
    const emotion = source.emotion && typeof source.emotion === 'object' ? source.emotion : {};
    const relationshipEvent = source.relationship_event && typeof source.relationship_event === 'object'
        ? source.relationship_event
        : {};

    return {
        name: cleanText(source.name),
        emotion: {
            label: cleanText(emotion.label, '平静'),
            intensity: clampNumber(emotion.intensity, 0, 100, 50),
        },
        tags: cleanTags(source.tags),
        status: {
            location: cleanText(status.location, '未知'),
            posture: cleanText(status.posture, '未观察到'),
            action: cleanText(status.action, '未观察到'),
            appearance: cleanText(status.appearance, '未观察到'),
            physical: cleanText(status.physical, '未观察到'),
            current_goal: cleanText(status.current_goal, '尚不明确'),
            attitude_to_player: cleanText(status.attitude_to_player, '尚不明确'),
        },
        relationship: sanitizeRelationship(source.relationship),
        relationship_event: {
            major: Boolean(relationshipEvent.major),
            reason: cleanText(relationshipEvent.reason),
        },
        mind: {
            surface: cleanText(mind.surface, '暂时无法判断。'),
            deep: cleanText(mind.deep, '暂时无法判断。'),
            unspoken: cleanText(mind.unspoken, '……'),
        },
        diary: {
            title: cleanText(diary.title, '无题'),
            content: cleanText(diary.content),
        },
    };
}

export function sanitizePayload(value, playerAliases = []) {
    const source = value && typeof value === 'object' ? value : {};
    const scene = source.scene && typeof source.scene === 'object' ? source.scene : {};
    const excluded = new Set([
        'user',
        'player',
        '玩家',
        '{{user}}',
        ...playerAliases,
    ].map(normalizeName).filter(Boolean));

    const seen = new Set();
    const characters = [];
    for (const rawCharacter of Array.isArray(source.characters) ? source.characters : []) {
        const character = sanitizeCharacter(rawCharacter);
        const key = normalizeName(character.name);
        if (!key || excluded.has(key) || seen.has(key)) continue;
        seen.add(key);
        characters.push(character);
    }

    return {
        scene: {
            location: cleanText(scene.location, '未知地点'),
            time: cleanText(scene.time, '当前'),
            atmosphere: cleanText(scene.atmosphere, '场景仍在继续'),
        },
        characters,
    };
}

function stabilizeRelationship(previous, next, isMajorEvent) {
    if (!previous || isMajorEvent) return sanitizeRelationship(next);
    const stable = {};
    for (const key of RELATIONSHIP_KEYS) {
        const oldValue = clampNumber(previous[key], 0, 100, 50);
        const newValue = clampNumber(next[key], 0, 100, oldValue);
        stable[key] = Math.min(oldValue + 8, Math.max(oldValue - 8, newValue));
    }
    return stable;
}

function cloneState(previous) {
    const source = previous && typeof previous === 'object' ? previous : EMPTY_STATE;
    return {
        schemaVersion: SCHEMA_VERSION,
        scene: { ...EMPTY_STATE.scene, ...(source.scene ?? {}) },
        npcDatabase: structuredClone(source.npcDatabase ?? {}),
        activeNpcKeys: Array.isArray(source.activeNpcKeys) ? [...source.activeNpcKeys] : [],
        updatedAt: Number(source.updatedAt) || 0,
    };
}

export function mergeTheaterState(previous, payload, options = {}) {
    const now = Number(options.now) || Date.now();
    const maxDiaryEntries = clampNumber(options.maxDiaryEntries, 1, 200, 50);
    const maxMindHistory = clampNumber(options.maxMindHistory, 1, 100, 30);
    const keepMindHistory = options.keepMindHistory !== false;
    const next = cloneState(previous);

    for (const record of Object.values(next.npcDatabase)) {
        if (record && typeof record === 'object') record.inScene = false;
    }

    next.scene = { ...EMPTY_STATE.scene, ...(payload.scene ?? {}) };
    next.activeNpcKeys = [];

    for (const character of payload.characters ?? []) {
        const key = normalizeName(character.name);
        if (!key) continue;
        const oldRecord = next.npcDatabase[key];
        const relationship = stabilizeRelationship(
            oldRecord?.current?.relationship,
            character.relationship,
            character.relationship_event?.major,
        );
        const current = { ...character, relationship };
        const diaryHistory = Array.isArray(oldRecord?.diaryHistory) ? [...oldRecord.diaryHistory] : [];
        const mindHistory = Array.isArray(oldRecord?.mindHistory) ? [...oldRecord.mindHistory] : [];
        const diaryContent = cleanText(character.diary?.content);
        const latestDiary = diaryHistory.at(-1);

        if (diaryContent && latestDiary?.content !== diaryContent) {
            diaryHistory.push({
                title: cleanText(character.diary?.title, '无题'),
                content: diaryContent,
                createdAt: now,
            });
        }

        if (keepMindHistory) {
            const latestMind = mindHistory.at(-1);
            const signature = JSON.stringify(character.mind ?? {});
            if (!latestMind || latestMind.signature !== signature) {
                mindHistory.push({
                    ...character.mind,
                    signature,
                    createdAt: now,
                });
            }
        }

        next.npcDatabase[key] = {
            key,
            name: character.name,
            inScene: true,
            firstSeenAt: oldRecord?.firstSeenAt || now,
            lastSeenAt: now,
            current,
            diaryHistory: diaryHistory.slice(-maxDiaryEntries),
            mindHistory: keepMindHistory ? mindHistory.slice(-maxMindHistory) : [],
        };
        next.activeNpcKeys.push(key);
    }

    next.updatedAt = now;
    return next;
}

export function summarizeContinuity(state, limit = 15) {
    const records = Object.values(state?.npcDatabase ?? {})
        .filter(record => record?.current)
        .sort((left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0))
        .slice(0, limit)
        .map(record => ({
            name: record.name,
            last_seen: record.lastSeenAt,
            was_in_previous_scene: Boolean(record.inScene),
            relationship: record.current.relationship,
            last_status: record.current.status,
            last_mind: record.current.mind,
            latest_diary: record.diaryHistory?.at(-1) ?? null,
        }));

    return {
        previous_scene: state?.scene ?? EMPTY_STATE.scene,
        known_npcs: records,
    };
}

export function themeHue(name) {
    let hash = 2166136261;
    for (const character of String(name ?? '')) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % 360;
}


