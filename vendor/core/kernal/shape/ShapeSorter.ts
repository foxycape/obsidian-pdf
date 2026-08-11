import { Mapping, Polygon, Rectangle } from "./definitions";

export class ShapeSorter {
  horizontal:boolean = true;
  threshold:number = 0;
  sortPolygons(polygons:Polygon[]): Mapping[] {
    let rectangles:Rectangle[] = [];
    for (let index = 0; index < polygons.length; index++) {
      const polygon = polygons[index];
      rectangles.push(this.convertPolygonToRectangle(polygon));
    }
    return this.sortRectangles(rectangles);
  }
  
  sortRectangles(rectangles:Rectangle[]): Mapping[] {
    rectangles = JSON.parse(JSON.stringify(rectangles));
    rectangles.sort((a, b) => (a.x**2 + a.y**2) - (b.x**2 + b.y**2))
    let lines = this.getLines(rectangles);
    return this.getMappingsFromRectangles(this.getRectangesFromLines(lines));
  }

  getRectangesFromLines(lines:Rectangle[][]):Rectangle[]{
    let rectangles:Rectangle[] = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      rectangles = rectangles.concat(line);
    }
    return rectangles;
  }

  getLines(rectangles:Rectangle[]):Rectangle[][] {
    let lines:Rectangle[][] = [];
    while (rectangles.length > 0) {
      let rect = rectangles[0];
      let clustered = this.clusterRectanglesToOneLine(rectangles,rect);
      if (clustered) {
        lines.push(clustered);
      } else {
        lines.push([rect]); //single rectangle as a line
      }
      rectangles.shift(); //delete the base rect
    }
    if (this.horizontal) {
      lines.sort((a, b) => (a[0].y - b[0].y));
    }else{
      lines.sort((a, b) => (a[0].x - b[0].x));
    }
    
    return lines;
  }

  clusterRectanglesToOneLine(rectangles:Rectangle[],baseRect:Rectangle):Rectangle[]|undefined{
    let line:Rectangle[] = [];
    for (let index = rectangles.length - 1; index >= 1; index--) { // start from the second element
      const rect = rectangles[index];
      if (this.rectanglesInOneLine(baseRect,rect)) {
        line.push(rect);
        rectangles.splice(index, 1); //delete the rectangle
      }
    }
    if (line.length>0) {
      line.push(baseRect);
      if (this.horizontal) {
        line.sort((a, b) => (a.x - b.x));
      }else{
        line.sort((a, b) => (a.y - b.y));
      }
      return line;
    }else{
      return undefined;
    }
  }

  rectanglesInOneLine(r1:Rectangle, r2:Rectangle) {
    if (this.horizontal) {
      let y = Math.max(r1.y, r2.y);
      let maxY1 = r1.y + r1.height;
      let maxY2 = r2.y + r2.height;
      let intersectH = Math.min(maxY1, maxY2) - y;
      if (intersectH>this.threshold) {
        return true;
      }else{
        return false;
      }
    }else{
      let x = Math.max(r1.x, r2.x);
      let maxX1 = r1.x + r1.width;
      let maxX2 = r2.x + r2.width;
      let intersectW = Math.min(maxX1, maxX2) - x;
      if (intersectW>0) {
        return true;
      }else{
        return false;
      }
    }
  }
    

  getMappingsFromRectangles(rectangles:Rectangle[]): Mapping[] {
    let mappings:Mapping[] = [];
    for (let index = 0; index < rectangles.length; index++) {
      const rect = rectangles[index];
      if (rect.mapping) {
        mappings.push(rect.mapping);
      }
    }
    return mappings;
  }

  convertPolygonToRectangle(polygon:Polygon):Rectangle{
    let minX:number;
    let minY:number;
    let maxX:number;
    let maxY:number;
    minX = polygon.points[0].x;
    minY = polygon.points[0].y;
    maxX = 0;
    maxY = 0;
    for (let index = 0; index < polygon.points.length; index++) {
      const point = polygon.points[index];
      minX = Math.min(minX,point.x);
      minY = Math.min(minY,point.y);
      maxX = Math.max(maxX,point.x);
      maxY = Math.max(maxY,point.y); 
    }
     
    const rect:Rectangle = {
      x:minX,
      y:minY,
      width: maxX-minX,
      height:maxY - minY,
      mapping:polygon.mapping
    }
    return rect;
  }
}