export function square(x: number) {
    return x * x
}


export interface Routes {
    square_root(_: {x: number}): {sqrt: number}
}
