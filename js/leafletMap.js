// leafletMap.js

class LeafletMap {
  /**
   * Class constructor with basic configuration
   * @param {Object} _config - e.g., { parentElement: '#my-map' }
   * @param {Array} _data - Earthquake data
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
    };
    this.data = _data;
    this.initVis();
  }

  initVis() {
    let vis = this;

    // Define basemap URLs and attributions
    vis.esriUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    vis.esriAttr =
      'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    vis.topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    vis.topoAttr =
      'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)';

    vis.stUrl =
      'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}';
    vis.stAttr =
      'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap contributors';

    // Create base layers
    vis.esriLayer = L.tileLayer(vis.esriUrl, {
      attribution: vis.esriAttr,
      ext: 'png',
    });
    vis.topoLayer = L.tileLayer(vis.topoUrl, {
      attribution: vis.topoAttr,
    });
    vis.stLayer = L.tileLayer(vis.stUrl, {
      attribution: vis.stAttr,
      ext: 'png',
    });

    // Bundle basemaps into an object for control
    vis.baseLayers = {
      "Esri Imagery": vis.esriLayer,
      "OpenTopoMap": vis.topoLayer,
      "Stamen Terrain": vis.stLayer,
    };

    // Initialize the map with default center and zoom level so data is visible immediately
    vis.theMap = L.map('my-map', {
      center: [30, 0],
      zoom: 2,
      layers: [vis.esriLayer],
    });

    // Add base layer control for background toggling
    L.control.layers(vis.baseLayers).addTo(vis.theMap);

    // Append SVG for D3 layers (making it clickable)
    L.svg({ clickable: true }).addTo(vis.theMap);
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane);
    vis.svg = vis.overlay.select("svg").attr("pointer-events", "auto");
    vis.g = vis.svg.append("g").attr("class", "leaflet-zoom-hide");

    // Preprocess earthquake data:
    // Convert lat, lng, magnitude, depth to numbers and add a Date and year property.
    vis.data.forEach(d => {
      d.latitude = +d.latitude;
      d.longitude = +d.longitude;
      d.mag = +d.mag;
      d.depth = +d.depth;
      d.time = new Date(d.time);
      d.year = d.time.getFullYear();
    });

    // Compute data domains for later scaling
    vis.minYear = d3.min(vis.data, d => d.year);
    vis.maxYear = d3.max(vis.data, d => d.year);
    vis.minMag = d3.min(vis.data, d => d.mag);
    vis.maxMag = d3.max(vis.data, d => d.mag);
    vis.minDepth = d3.min(vis.data, d => d.depth);
    vis.maxDepth = d3.max(vis.data, d => d.depth);

    // Set default color scheme attribute; options include "year", "mag", and "depth."
    vis.currentColorBy = "mag";

    // Define color scales for each type of attribute.
    vis.colorScale = {
      year: d3.scaleSequential(d3.interpolateViridis).domain([vis.minYear, vis.maxYear]),
      mag: d3.scaleSequential(d3.interpolateOrRd).domain([vis.minMag, vis.maxMag]),
      depth: d3.scaleSequential(d3.interpolateYlGnBu).domain([vis.minDepth, vis.maxDepth]),
    };

    // Create earthquake markers as circles.
    // In leafletMap.js - inside your LeafletMap.initVis method,
// update the mouseover and mouseout event handlers for the circles:

vis.circles = vis.g.selectAll("circle")
.data(vis.data)
.join("circle")
.attr("fill", d => vis.colorScale[vis.currentColorBy](d[vis.currentColorBy]))
.attr("stroke", "black")
.attr("fill-opacity", 0.6)
.attr("stroke-width", 0.5)
.attr("r", d => vis.getCircleRadius(d))
.on("mouseover", function(event, d) {
  // Enlarge circle on hover
  d3.select(this)
    .transition()
    .duration(150)
    .attr("r", vis.getCircleRadius(d) * 1.5);
  
  // Use d3.pointer to get coordinates relative to the document body
  const [x, y] = d3.pointer(event, document.body);
  
  // Show tooltip with earthquake details
  d3.select("#tooltip")
    .style("opacity", 1)
    .html(`
      <strong>Location:</strong> ${d.place}<br/>
      <strong>Date:</strong> ${d.time.toLocaleString()}<br/>
      <strong>Magnitude:</strong> ${d.mag}<br/>
      <strong>Depth:</strong> ${d.depth} km
    `)
    .style("left", (x + 10) + "px")
    .style("top", (y - 28) + "px")
    .style("z-index", "10000");
})
.on("mouseout", function(event, d) {
  d3.select(this)
    .transition()
    .duration(150)
    .attr("r", vis.getCircleRadius(d));
  d3.select("#tooltip")
    .style("opacity", 0);
});


    // Set positions for the circles initially and whenever the map zooms, for dynamic panning/zooming.
    vis.updatePositions();
    vis.theMap.on("zoomend", () => vis.updatePositions());

    // Listen to UI changes for color scheme: update the circle fill on dropdown change.
    d3.select("#color-by").on("change", function() {
      vis.currentColorBy = this.value;
      vis.circles.transition().duration(500)
        .attr("fill", d => vis.colorScale[vis.currentColorBy](d[vis.currentColorBy]));
    });

    // Optional: Toggle for sizing by magnitude.
    d3.select("#size-by-mag").on("change", function() {
      vis.updatePositions();
    });
  }

  // Helper to compute circle radius based on quake magnitude (if toggled) and map zoom level.
  getCircleRadius(d) {
    let baseRadius = 3;
    // Check if the "size-by-mag" checkbox is enabled.
    let sizeByMag = d3.select("#size-by-mag").property("checked");
    if (sizeByMag) {
      baseRadius = d.mag * 2;
    }
    // Increase radius slightly with zoom to maintain visibility.
    let currentZoom = this.theMap.getZoom();
    return baseRadius + (currentZoom - 2);
  }

  // Reproject circle positions on each zoom event.
  updatePositions() {
    const vis = this;
    vis.circles
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr("r", d => vis.getCircleRadius(d));
  }
}