declare module "mersenne-twister" {
    export default class MersenneTwister {
        constructor(seed?: number);
        random(): number;
    }
}
