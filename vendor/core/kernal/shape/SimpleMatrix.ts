export class SimpleMatrix {
    constructor(a: number, b: number, c: number, d: number, e: number, f: number) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
    }
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;

    toArray() {
        return [this.a, this.b, this.c, this.d, this.e, this.f]
    }
    toStyle() {
        return "matrix(" + this.a + "," + this.b + "," + this.c + "," + this.d + "," + this.e + "," + this.f + ")"
    }
}
