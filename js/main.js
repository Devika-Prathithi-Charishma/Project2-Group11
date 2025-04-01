// main.js

// Initialize map with empty data first
let leafletMap;

// Load initial data and setup year selector
document.addEventListener('DOMContentLoaded', function() {
  // Create year selector dropdown
  setupYearSelector();
  
  // Load initial data (default year or combined data)
  loadYearData('2024'); // Default to most recent complete year
});

document.addEventListener('DOMContentLoaded', function() {
  // Add other existing code
  
  // Add specific event listener for the distribution dropdown
  document.getElementById('dist-select').addEventListener('change', function() {
    const selectedDist = this.value;
    if (selectedDist) { // Only proceed if a value is selected
      // Use the current dataset (filtered or full)
      renderDistribution(window.currentData, selectedDist);
    }
  });
});

function setupYearSelector() {
  // Create year selector if it doesn't exist
  if (!document.getElementById('year-selector')) {
    const controlPanel = document.querySelector('.control-panel');
    
    const yearGroup = document.createElement('div');
    yearGroup.className = 'control-group';
    
    const yearLabel = document.createElement('label');
    yearLabel.setAttribute('for', 'year-selector');
    yearLabel.textContent = 'Select Year:';
    
    const yearSelector = document.createElement('select');
    yearSelector.id = 'year-selector';
    
    // Add years from 2004 to 2025
    const currentYear = 2025;
    for (let year = 2004; year <= currentYear; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === 2024) option.selected = true; // Set 2024 as default
      yearSelector.appendChild(option);
    }
    
    // Add option for all years
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Years (2004-2025)';
    yearSelector.appendChild(allOption);
    
    yearGroup.appendChild(yearLabel);
    yearGroup.appendChild(yearSelector);
    controlPanel.insertBefore(yearGroup, controlPanel.firstChild);
    
    // Add event listener for year selection
    yearSelector.addEventListener('change', function() {
      const selectedYear = this.value;
      loadYearData(selectedYear);
    });
  }
}

function loadYearData(year) {
  const dataFile = (year === "all") ? "data/2004-2025.csv" : `data/${year}/${year}.csv`;

  // Ensure the map container exists.
  let mapContainer = document.getElementById("my-map");
  if (!mapContainer) {
      mapContainer = document.createElement("div");
      mapContainer.id = "my-map";
      document.body.insertBefore(mapContainer, document.body.firstChild);
  }

  // Remove previous map instance, if any.
  if (leafletMap && leafletMap.theMap) {
      leafletMap.theMap.remove();
      leafletMap = null;
  }
  mapContainer._leaflet_id = null;

  // Show loading indicator.
  const loadingMsg = document.createElement("div");
  loadingMsg.id = "loading-message";
  loadingMsg.textContent = `Loading earthquake data for ${year === "all" ? "all years" : year}...`;
  loadingMsg.style = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 10px; border-radius: 5px; z-index: 1000;";
  document.body.appendChild(loadingMsg);

  d3.csv(dataFile)
    .then(data => {
      document.body.removeChild(document.getElementById("loading-message"));
      console.log(`Number of earthquake records for ${year}: ${data.length}`);

      // Convert strings to numbers and parse dates.
      data.forEach(d => {
          d.latitude = +d.latitude;
          d.longitude = +d.longitude;
          d.mag = +d.mag;
          d.depth = +d.depth;
          d.time = new Date(d.time);
          d.year = d.time.getFullYear();
      });

      // Render timeline and update views (which adds the heatmap).
      renderTimeline(data);
      updateViews(data);
      window.currentData = data;
      // NEW: Update record count at the bottom of the page.
      document.getElementById("record-count").innerHTML = 
      `Number of earthquake records for ${year}: ${data.length}`;
    })
    .catch(error => {
      if (document.getElementById("loading-message")) {
          document.body.removeChild(document.getElementById("loading-message"));
      }
      console.error(`Error loading earthquake data for ${year}:`, error);
      const errorMsg = document.createElement("div");
      errorMsg.textContent = `Error loading data for ${year}. Please try another year.`;
      errorMsg.style = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 10px; border-radius: 5px; z-index: 1000; color: red;";
      document.body.appendChild(errorMsg);
      setTimeout(() => {
          document.body.removeChild(errorMsg);
      }, 3000);
    });
}


// Add this function in main.js (or in a separate timeline.js file that you import)
function renderTimeline(data) {
  d3.select("#timeline").selectAll("*").remove();
  // Set up margins and dimensions
  const margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = 800 - margin.left - margin.right,
        height = 150 - margin.top - margin.bottom;

  // Create an SVG container in the timeline div
  const svg = d3.select("#timeline")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Get the time domain from your earthquake data
  const minDate = d3.min(data, d => d.time);
  const maxDate = d3.max(data, d => d.time);

  // Create a time scale for the X axis
  const x = d3.scaleTime()
              .domain([minDate, maxDate])
              .range([0, width]);
   window.timelineX = x;  // Store x-scale globally for animation.

  // Choose to bin by week to capture intra-year variations
  const binsGenerator = d3.bin()
                          .value(d => d.time)
                          .domain(x.domain())
                          .thresholds(d3.timeWeek.range(minDate, maxDate));

  const bins = binsGenerator(data);

  // Create a linear scale for the Y axis based on bin counts
  const y = d3.scaleLinear()
              .domain([0, d3.max(bins, d => d.length)])
              .range([height, 0]);

  // Create bars for the histogram
  svg.selectAll("rect")
    .data(bins)
    .enter().append("rect")
      .attr("x", d => x(d.x0))
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("height", d => height - y(d.length))
      .attr("fill", "steelblue")
      .on("mouseover", function(event, d) {
         // Use d3.pointer to get position (you could adjust as needed)
         const [xPos, yPos] = d3.pointer(event, document.body);
         // Show tooltip with the starting date of the bin and count
         d3.select("#tooltip")
           .style("opacity", 1)
           .html(`<strong>Date:</strong> ${d3.timeFormat("%Y-%m-%d")(d.x0)}<br/><strong>Count:</strong> ${d.length}`)
           .style("left", (xPos + 10) + "px")
           .style("top", (yPos - 28) + "px")
           .style("z-index", "10000");
      })
      .on("mouseout", function(event, d) {
         d3.select("#tooltip").style("opacity", 0);
      });

  // Add the X axis below the histogram
  svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks(5));

  // Add the Y axis to the left of the histogram
  svg.append("g")
      .call(d3.axisLeft(y).ticks(3));

  // Optionally, you may wish to add brush and linking to allow selection of a date range.

  // Create a brush for selecting a time range
  const brush = d3.brushX()
                  .extent([[0, 0], [width, height]])
                  .on("end", brushEnded);
  
  // Append the brush to the SVG
  svg.append("g")
     .attr("class", "brush")
     .call(brush);
  
  // Add a "Clear Selection" button below the timeline
  d3.select("#timeline")
    .append("button")
    .attr("class", "clear-brush")
    .text("Clear Selection")
    .on("click", function(){
         // Remove any active brush selection and update with full data
         svg.select(".brush").call(brush.move, null);
         updateViews(data);
         d3.select(".animation-line").remove();
         // Also reset animation state if it was running
        if (isAnimating) {
          isAnimating = false;
          if (animInterval) animInterval.stop();
        }
    });
  
  // Function that is called when the brush is ended
  function brushEnded({ selection }) {
      if (!selection) {
         // No selection means clear the filter: show all data
         updateViews(data);
      } else {
         const [x0, x1] = selection;
         const brushStart = x.invert(x0);
         const brushEnd = x.invert(x1);
         // Filter the data based on the brushed time range
         const filteredData = data.filter(d => d.time >= brushStart && d.time <= brushEnd);
         updateViews(filteredData);
      }
  }
}

function updateViews(filteredData) {
  // Remove previous map instance if it exists.
  if (leafletMap && leafletMap.theMap) {
      leafletMap.theMap.remove();
      leafletMap = null;
  }
  const mapContainer = document.getElementById("my-map");
  if (mapContainer) {
      mapContainer._leaflet_id = null;
  }
  
  // Create a new map instance with the filtered data.
  leafletMap = new LeafletMap({ parentElement: "#my-map" }, filteredData);

  // Update the distribution view based on current selection.
  const selectedDist = document.getElementById("dist-select") ? document.getElementById("dist-select").value : "mag";
  renderDistribution(filteredData, selectedDist);

  // Remove any existing heatLayer.
  if (window.heatLayer) {
      if (leafletMap.theMap.hasLayer(window.heatLayer)) {
          leafletMap.theMap.removeLayer(window.heatLayer);
      }
      window.heatLayer = null;
  }
  
  // Create a new heatLayer with the filtered data.
  const heatData = transformData(filteredData);
  window.heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 10
  }).addTo(leafletMap.theMap);
}

function transformData(data) {
  return data.map(d => [d.latitude, d.longitude, d.mag]);
}




// Renders the distribution view (Level 3) – calls appropriate function based on type.
function renderDistribution(data, type) {
  d3.select("#distribution").html("");
  if (type === "mag") {
      renderMagnitudeChart(data);
  } else if (type === "depth") {
      renderDepthChart(data);
  } else if (type === "duration") {
      renderDurationChart(data); // Bonus: duration view (placeholder)
  }
}


// Histogram for earthquake frequencies by Magnitude.
function renderMagnitudeChart(data) {
  const margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = 500 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;
  const container = d3.select("#distribution");
  container.append("h3")
           .text("Earthquake Frequency by Magnitude")
           .style("text-align", "center")
           .style("margin-bottom", "10px");
  const svg = container.append("svg")
                       .attr("width", width + margin.left + margin.right)
                       .attr("height", height + margin.top + margin.bottom)
                       .append("g")
                       .attr("transform", `translate(${margin.left},${margin.top})`);
  const minMag = d3.min(data, d => d.mag);
  const maxMag = d3.max(data, d => d.mag);
  const x = d3.scaleLinear()
              .domain([Math.floor(minMag), Math.ceil(maxMag)])
              .range([0, width]);
  const bins = d3.bin()
                 .value(d => d.mag)
                 .domain(x.domain())
                 .thresholds(x.ticks((Math.ceil(maxMag) - Math.floor(minMag)) * 2))(data);
  const y = d3.scaleLinear()
              .domain([0, d3.max(bins, d => d.length)])
              .range([height, 0]);
  svg.selectAll("rect")
     .data(bins)
     .enter().append("rect")
     .attr("x", d => x(d.x0) + 1)
     .attr("y", d => y(d.length))
     .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
     .attr("height", d => height - y(d.length))
     .attr("fill", "tomato")
     .on("mouseover", function(event, d) {
         const [xPos, yPos] = d3.pointer(event, document.body);
         d3.select("#tooltip")
           .style("opacity", 1)
           .html(`<strong>Magnitude Range:</strong> ${d.x0.toFixed(1)} - ${d.x1.toFixed(1)}<br/><strong>Count:</strong> ${d.length}`)
           .style("left", (xPos+10)+"px")
           .style("top", (yPos-28)+"px")
           .style("z-index", "10000");
     })
     .on("mouseout", function(event, d) {
         d3.select("#tooltip").style("opacity", 0);
     });
  svg.append("g")
     .attr("transform", `translate(0,${height})`)
     .call(d3.axisBottom(x));
  svg.append("g")
     .call(d3.axisLeft(y));
}

// Histogram for earthquake frequencies by Depth.
function renderDepthChart(data) {
  const margin = { top: 20, right: 20, bottom: 30, left: 50 },
        width = 500 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;
  const container = d3.select("#distribution");
  container.append("h3")
           .text("Earthquake Frequency by Depth")
           .style("text-align", "center")
           .style("margin-bottom", "10px");
  const svg = container.append("svg")
                       .attr("width", width + margin.left + margin.right)
                       .attr("height", height + margin.top + margin.bottom)
                       .append("g")
                       .attr("transform", `translate(${margin.left},${margin.top})`);
  const minDepth = d3.min(data, d => d.depth);
  const maxDepth = d3.max(data, d => d.depth);
  const x = d3.scaleLinear()
              .domain([0, maxDepth])
              .range([0, width]);
  const bins = d3.bin()
                 .value(d => d.depth)
                 .domain(x.domain())
                 .thresholds(x.ticks(20))(data);
  const y = d3.scaleLinear()
              .domain([0, d3.max(bins, d => d.length)])
              .range([height, 0]);
  svg.selectAll("rect")
     .data(bins)
     .enter().append("rect")
     .attr("x", d => x(d.x0) + 1)
     .attr("y", d => y(d.length))
     .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
     .attr("height", d => height - y(d.length))
     .attr("fill", "seagreen")
     .on("mouseover", function(event, d) {
         const [xPos, yPos] = d3.pointer(event, document.body);
         d3.select("#tooltip")
           .style("opacity", 1)
           .html(`<strong>Depth Range:</strong> ${d.x0.toFixed(1)} - ${d.x1.toFixed(1)} km<br/><strong>Count:</strong> ${d.length}`)
           .style("left", (xPos+10)+"px")
           .style("top", (yPos-28)+"px")
           .style("z-index", "10000");
     })
     .on("mouseout", function(event, d) {
         d3.select("#tooltip").style("opacity", 0);
     });
  svg.append("g")
     .attr("transform", `translate(0,${height})`)
     .call(d3.axisBottom(x));
  svg.append("g")
     .call(d3.axisLeft(y));
}

// (Bonus) Histogram for earthquake frequencies by Duration.
function renderDurationChart(data) {
  d3.select("#distribution").html("");
  d3.select("#distribution")
    .append("h3")
    .text("Earthquake Frequency by Duration (Bonus)")
    .style("text-align", "center")
    .style("margin-bottom", "10px");
  d3.select("#distribution")
    .append("p")
    .text("Duration data is not currently available – this is a bonus requirement.");
}

// Global variables for animation
let animInterval;
let isAnimating = false;

// Attach event listeners for animation buttons
document.getElementById('animate-btn').addEventListener('click', function() {
  if (!isAnimating) {
    isAnimating = true;
    startAnimation();
  }
});
document.getElementById('stop-btn').addEventListener('click', function() {
  isAnimating = false;
  if (animInterval) animInterval.stop();
});

// Function to start the animation.
function startAnimation() {
  if (!window.currentData || window.currentData.length === 0) return;
  
  // Sort the data array by time.
  const sortedData = window.currentData.sort((a, b) => a.time - b.time);
  // Set currentTime to earliest event time.
  let currentTime = new Date(sortedData[0].time.getTime());
  const endTime = sortedData[sortedData.length - 1].time;
  
  const speed = +document.getElementById('anim-speed').value;
  
  animInterval = d3.interval(() => {
    currentTime.setDate(currentTime.getDate() + 1); // Advance by one day.
    if (currentTime > endTime) {
      animInterval.stop();
      isAnimating = false;
      return;
    }
    const filteredData = sortedData.filter(d => d.time <= currentTime);
    updateViews(filteredData);
    highlightTimeInTimeline(currentTime);
  }, speed);
}


// Fix for the highlightTimeInTimeline function
function highlightTimeInTimeline(currentTime) {
  if (!window.timelineX) return;
  
  // Calculate position (this needs to include the margin)
  const xPos = window.timelineX(currentTime);
  const timelineSvg = d3.select("#timeline svg");
  const timelineG = d3.select("#timeline svg g"); // Get the g element with margin translation
  
  if (timelineSvg.empty()) return;
  
  // Get the margin value (extracted from the transform attribute)
  const transform = timelineG.attr("transform");
  const leftMargin = parseInt(transform.split("translate(")[1].split(",")[0]) || 0;
  
  let animLine = timelineSvg.select(".animation-line");
  if (animLine.empty()) {
    // Add the left margin to the x position
    timelineSvg.append("line")
      .attr("class", "animation-line")
      .attr("x1", xPos + leftMargin)
      .attr("x2", xPos + leftMargin)
      .attr("y1", 0)
      .attr("y2", timelineSvg.attr("height"))
      .attr("stroke", "red")
      .attr("stroke-width", 2);
  } else {
    // Update existing line with correct position
    animLine
      .attr("x1", xPos + leftMargin)
      .attr("x2", xPos + leftMargin);
  }
}
