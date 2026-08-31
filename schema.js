const stringField = { type: 'string' };
const scoreField = { type: 'integer', minimum: 0, maximum: 100 };

export const THEATER_SCHEMA_VALUE = {
    type: 'object',
    additionalProperties: false,
    properties: {
        scene: {
            type: 'object',
            additionalProperties: false,
            properties: {
                location: stringField,
                time: stringField,
                atmosphere: stringField,
            },
            required: ['location', 'time', 'atmosphere'],
        },
        characters: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: stringField,
                    emotion: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            label: stringField,
                            intensity: scoreField,
                        },
                        required: ['label', 'intensity'],
                    },
                    tags: {
                        type: 'array',
                        items: stringField,
                        maxItems: 5,
                    },
                    status: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            location: stringField,
                            posture: stringField,
                            action: stringField,
                            appearance: stringField,
                            physical: stringField,
                            current_goal: stringField,
                            attitude_to_player: stringField,
                        },
                        required: [
                            'location',
                            'posture',
                            'action',
                            'appearance',
                            'physical',
                            'current_goal',
                            'attitude_to_player',
                        ],
                    },
                    relationship: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            favor: scoreField,
                            trust: scoreField,
                            guard: scoreField,
                            interest: scoreField,
                            stress: scoreField,
                        },
                        required: ['favor', 'trust', 'guard', 'interest', 'stress'],
                    },
                    relationship_event: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            major: { type: 'boolean' },
                            reason: stringField,
                        },
                        required: ['major', 'reason'],
                    },
                    mind: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            surface: stringField,
                            deep: stringField,
                            unspoken: stringField,
                        },
                        required: ['surface', 'deep', 'unspoken'],
                    },
                    diary: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            title: stringField,
                            content: stringField,
                        },
                        required: ['title', 'content'],
                    },
                },
                required: [
                    'name',
                    'emotion',
                    'tags',
                    'status',
                    'relationship',
                    'relationship_event',
                    'mind',
                    'diary',
                ],
            },
        },
    },
    required: ['scene', 'characters'],
};

export const SILLYTAVERN_THEATER_SCHEMA = {
    name: 'npc_theater_scene',
    description: 'All NPCs physically present in the current roleplay scene, excluding the player.',
    strict: true,
    value: THEATER_SCHEMA_VALUE,
};

export const OPENAI_THEATER_RESPONSE_FORMAT = {
    type: 'json_schema',
    json_schema: {
        name: SILLYTAVERN_THEATER_SCHEMA.name,
        description: SILLYTAVERN_THEATER_SCHEMA.description,
        strict: true,
        schema: THEATER_SCHEMA_VALUE,
    },
};

