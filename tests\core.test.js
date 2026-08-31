import assert from 'node:assert/strict';
import test from 'node:test';

import {
    EMPTY_STATE,
    extractModelIds,
    mergeTheaterState,
    normalizeName,
    parseTheaterResponse,
    sanitizePayload,
    resolveModelsEndpoint,
    summarizeContinuity,
    themeHue,
} from '../core.js';

test('derives the OpenAI-compatible models endpoint', () => {
    assert.equal(resolveModelsEndpoint('https://api.example.com/v1/chat/completions'), 'https://api.example.com/v1/models');
    assert.equal(resolveModelsEndpoint('https://api.example.com/v1'), 'https://api.example.com/v1/models');
});

test('extracts and sorts common model-list response shapes', () => {
    assert.deepEqual(extractModelIds({ data: [{ id: 'model-10' }, { id: 'model-2' }, { id: 'model-2' }] }), ['model-2', 'model-10']);
    assert.deepEqual(extractModelIds({ models: ['beta', { name: 'alpha' }] }), ['alpha', 'beta']);
});

function character(name, overrides = {}) {
    return {
        name,
        emotion: { label: '警惕', intensity: 65 },
        tags: ['戒备', '好奇'],
        status: {
            location: '教室后排',
            posture: '抱臂站立',
            action: '观察玩家',
            appearance: '校袍整齐',
            physical: '正常',
            current_goal: '确认异常来源',
            attitude_to_player: '戒备中带有兴趣',
        },
        relationship: { favor: 43, trust: 25, guard: 64, interest: 82, stress: 42 },
        relationship_event: { major: false, reason: '' },
        mind: { surface: '不对劲。', deep: '好奇心正在占上风。', unspoken: '你怎么做到的？' },
        diary: { title: '奇怪的一天', content: '今天发生了一件怪事。' },
        ...overrides,
    };
}

test('normalizes names consistently', () => {
    assert.equal(normalizeName(' 德拉科·马尔福 '), normalizeName('德拉科 马尔福'));
    assert.equal(themeHue('德拉科'), themeHue('德拉科'));
});

test('parses JSON from a fenced model response', () => {
    const parsed = parseTheaterResponse('```json\n{"scene":{},"characters":[]}\n```');
    assert.deepEqual(parsed.characters, []);
});

test('strictly excludes the player and de-duplicates NPCs', () => {
    const payload = sanitizePayload({
        scene: { location: '礼堂', time: '夜晚', atmosphere: '安静' },
        characters: [character('凯洛'), character('德拉科'), character(' 德拉科 ')],
    }, ['凯洛']);
    assert.deepEqual(payload.characters.map(item => item.name), ['德拉科']);
});

test('keeps relationship drift within eight points without a major event', () => {
    const firstPayload = sanitizePayload({
        scene: {},
        characters: [character('德拉科')],
    });
    const first = mergeTheaterState(EMPTY_STATE, firstPayload, { now: 1000 });
    const secondPayload = sanitizePayload({
        scene: {},
        characters: [character('德拉科', {
            relationship: { favor: 99, trust: 0, guard: 5, interest: 20, stress: 90 },
            diary: { title: '第二次', content: '又发生了一件事。' },
        })],
    });
    const second = mergeTheaterState(first, secondPayload, { now: 2000 });
    const relation = second.npcDatabase[normalizeName('德拉科')].current.relationship;
    assert.deepEqual(relation, { favor: 51, trust: 17, guard: 56, interest: 74, stress: 50 });
});

test('replaces mind and diary without preserving or prompting with their history', () => {
    const first = mergeTheaterState(EMPTY_STATE, sanitizePayload({
        scene: {},
        characters: [character('潘西')],
    }), { now: 1000 });
    const second = mergeTheaterState(first, sanitizePayload({
        scene: {},
        characters: [character('潘西', {
            mind: { surface: '新的念头。', deep: '新的动机。', unspoken: '新的话。' },
            diary: { title: '新的一幕', content: '只记录这一轮。' },
        })],
    }), { now: 2000 });
    const activeRecord = second.npcDatabase[normalizeName('潘西')];
    assert.equal(activeRecord.current.mind.surface, '新的念头。');
    assert.equal(activeRecord.current.diary.content, '只记录这一轮。');
    assert.equal('mindHistory' in activeRecord, false);
    assert.equal('diaryHistory' in activeRecord, false);

    const third = mergeTheaterState(second, sanitizePayload({ scene: {}, characters: [] }), { now: 3000 });
    const hiddenRecord = third.npcDatabase[normalizeName('潘西')];
    assert.equal(hiddenRecord.inScene, false);
    assert.equal('mind' in hiddenRecord.current, false);
    assert.equal('diary' in hiddenRecord.current, false);
    assert.deepEqual(third.activeNpcKeys, []);

    const continuity = summarizeContinuity(third).known_npcs[0];
    assert.equal(continuity.name, '潘西');
    assert.equal('last_mind' in continuity, false);
    assert.equal('latest_diary' in continuity, false);
});
