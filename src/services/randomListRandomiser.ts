// ============================================================================
// File: randomListRandomiser.ts
// Path: src/services/randomListRandomiser.ts
// Description:
//  - Deterministic MT19937 shuffle (Fisher–Yates)
//  - Pure function (no DB, no API, no side effects)
// ============================================================================

import MersenneTwister from "mersenne-twister";

// ============================================================================
// Types
// ============================================================================

export type ShuffleItem = {
    id: string;
};

// ============================================================================
// Shuffle using MT19937
// ============================================================================

export function shuffleWithMT(
    items: ShuffleItem[],
    seedInt: number
): ShuffleItem[] {
    const mt = new MersenneTwister(seedInt);
    const arr = [...items];

    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(mt.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}
