export interface Point {
  x:number;
  y:number;
}

export interface Mapping {
  originalIndex?:number;
  row?:number;
  column?:number;
}

export interface Polygon {
  points:Point[];
  mapping?:Mapping;
}

export interface Rectangle {
  x:number;
  y:number;
  width:number;
  height:number;
  mapping?:Mapping;
}