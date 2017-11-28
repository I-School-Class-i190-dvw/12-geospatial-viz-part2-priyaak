console.log("hello world!");

// set the width and height using window size, but at least 960 by 500
var width = Math.max(960, window.innerWidth),
    height = Math.max(500, window.innerHeight);

// use pi to get tau bc tau is better
var pi = Math.PI,
    tau = 2 * pi;

// create a spherical mercator projection (i thought this was bad)
var projection = d3.geoMercator()
  .scale(1 / tau) // set projection's scale factor
  .translate([0, 0]); // translate offset to center projection

// path generator to draw this projection
var path = d3.geoPath()
  .projection(projection);

// split window into a quadtree to better render map
var tile = d3.tile()
  .size([width, height]);

// create a (restricted) zoom behavior
// restricted bc you can't zoom out more than min or zoom in more than max
var zoom = d3.zoom()
  .scaleExtent([
    1 << 11,  // min: left shift 1, 11 times = 2048
    1 << 24   // max: 2^24
  ])
  .on('zoom', zoomed); // bind event listener

// make a radius scale for circles
var radius = d3.scaleSqrt().range([0, 10]);

// make the svg element and define its size
var svg = d3.select('body')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

// define a svg grouping for raster
var raster = svg.append('g');

// render to a single path:
// var vector = svg.append('path');

// render to multiple paths:
var vector = svg.selectAll('path');

// async load the california earthquake data
d3.json('data/earthquakes_4326_cali.geojson', function(error, geojson) {
  // error handling
  if (error) throw error;

  console.log(geojson); // does the data look alright? yup.

  // set radius domain to the range [0, the highest earthquake magnitude]
  radius.domain([0, d3.max(geojson.features, function(d) {
    return d.properties.mag;
  })]);

  // set the radius' of points based on earthquake magnitude
  path.pointRadius(function(d) {
    return radius(d.properties.mag);
  });

  // render to a single path:
  // vector = vector.datum(geojson);

  // render to multiple paths:
  vector = vector
    .data(geojson.features) // bind the data
    .enter().append('path')
    .attr('d', path)  // draw the path
    // log when you hover and change opacity in css
    .on('mouseover', function(d) { console.log(d); });

  // center the map at san francisco
  var center = projection([-119.665, 37.414]);

  // have svg get the zoom function we made earlier
  svg.call(zoom)
    // intro zoom, yay!
    .call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale (1 << 14)
        .translate(-center[0], -center[1])
    );
});

// function to deal with zooming
function zoomed() {
  var transform = d3.event.transform; // shortcut for later

  // zoom tiles based on zoom factor
  // translate based on where the user is
  var tiles = tile
    .scale(transform.k)
    .translate([transform.x, transform.y])
    ();

  // basically gives x, y, and zoom factor
  console.log(transform.x, transform.y, transform.k);

  // scale and translate projection to account for zooming
  projection
    .scale(transform.k / tau)
    .translate([transform.x, transform.y]);

  // draw it all out
  vector.attr('d', path);

  // translate the raster grouping and begin a general update pattern w images
  var image = raster
    .attr('transform', stringify(tiles.scale, tiles.translate))
    .selectAll('image')
    // data are transformed quadtree tiles
    .data(tiles, function(d) { return d; });

  // remove images not bound to data
  image.exit().remove();

  // do the following for data that isn't yet bound to an image
  image.enter().append('image')
    .attr('xlink:href', function(d) {
      return 'https://' + 'abc'[d[1] % 3] + '.basemaps.cartocdn.com/rastertiles/voyager/' +
        d[2] + '/' + d[0] + '/' + d[1] + '.png';
    }) // link to an image to render based on x, y, and zoom factor
    .attr('x', function(d) { return d[0] * 256; })
    .attr('y', function(d) { return d[1] * 256; })
    .attr('width', 256)
    .attr('height', 256);

} // end of zoomed

// helper function to create a translate string by scaling translate
function stringify(scale, translate) {
  var k = scale / 256,  // bc we multiply 256 back when we add the image
      r = scale % 1 ? Number : Math.round;  // ensure it's an int
  return 'translate(' + r(translate[0] * scale) + ',' + r(translate[1] * scale) + ') scale (' + k + ')';
}
