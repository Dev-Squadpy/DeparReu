const KEY_MAP = {
    'Plataforma': 'P',
    'Microfono 1': 'M1',
    'Microfono 2': 'M2',
    'Acomodador Entrada': 'AE',
    'Acomodador Auditorio': 'AA',
    'Audio y Video': 'AV'
};

const REVERSE_KEY_MAP = Object.fromEntries(
    Object.entries(KEY_MAP).map(([k, v]) => [v, k])
);

const STATUS_MAP = {
    'true': '1',
    'false': '0',
    'null': '_'
};

const REVERSE_STATUS_MAP = {
    '1': true,
    '0': false,
    '_': null
};

export const compressAssignments = (assignments) => {
    if (!assignments) return '{}';
    const compressed = {};

    Object.entries(assignments).forEach(([pos, data]) => {
        const shortKey = KEY_MAP[pos] || pos;
        const status = STATUS_MAP[String(data.confirmed)] || '_';
        compressed[shortKey] = `${data.name}|${status}`;
    });

    return JSON.stringify(compressed);
};

export const decompressAssignments = (jsonStr) => {
    if (!jsonStr) return {};
    let data;
    try {
        data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    } catch (e) {
        console.error("Error parsing assignments JSON:", e);
        return {};
    }

    const decompressed = {};

    Object.entries(data).forEach(([key, val]) => {
        // Backward compatibility: If val is an object, it's the old format
        if (typeof val === 'object' && val !== null) {
            const fullKey = REVERSE_KEY_MAP[key] || key;
            decompressed[fullKey] = val;
            return;
        }

        // New compressed format: "name|status"
        if (typeof val === 'string' && val.includes('|')) {
            const [name, statusCode] = val.split('|');
            const fullKey = REVERSE_KEY_MAP[key] || key;
            decompressed[fullKey] = {
                name,
                confirmed: REVERSE_STATUS_MAP[statusCode] ?? null
            };
        } else {
            // Fallback for unexpected formats
            const fullKey = REVERSE_KEY_MAP[key] || key;
            decompressed[fullKey] = { name: val, confirmed: null };
        }
    });

    return decompressed;
};
