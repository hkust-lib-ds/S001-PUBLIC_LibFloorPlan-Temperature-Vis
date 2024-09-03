const numOfColors = 10;
const minValue = 20;
const maxValue = 28;
const numLegendItems = 5;
const radius = 175;

const heatmapContainer = document.getElementById('heatmapContainer');
const overlayCanvas = document.getElementById('canvas');
overlayCanvas.width = 1600;
overlayCanvas.height = 850;

// settings for the colour bar
const colorScale = chroma
  .scale(['rgb(0,0,255)','rgb(0,255,255)','rgb(0,255,0)','rgb(220,220,0)','red'])
  .domain([minValue, 25.5, maxValue])
  .mode('lab')
  .colors(numOfColors);
var colours = [];
colorScale.forEach((color, index) => {
  const tempRange = (maxValue - minValue) / numOfColors;
  const tempStart = minValue + index * tempRange;
  const tempEnd = tempStart + tempRange;
  colours.push({ color: color, minValue: tempStart, maxValue: tempEnd });
});

let colorBar = document.createElement('div');
colorBar.classList.add('colorbar');
colorBar.style.background = `linear-gradient(to bottom, ${colorScale})`;

const legendValues = [];
for (let i = 0; i < numLegendItems; i++) {
  let temp = Math.round(maxValue - ((i / (numLegendItems - 1)) * (maxValue - minValue)));
  legendValues.push(temp + "°C");
}

// settings for legend values
let legendContainer = document.createElement('div');
legendContainer.classList.add('legend');

legendValues.forEach((value, index) => {
  let legendItem = document.createElement('div');
  legendItem.textContent = value;
  legendItem.style.color = 'black';
  legendContainer.appendChild(legendItem);
});

heatmapContainer.appendChild(colorBar);
heatmapContainer.appendChild(legendContainer);

let points = [];
let boundaryPolygon;

function calculateCentroid(polygonCoordinates) {
  let centroidX = 0;
  let centroidY = 0;
  const numPoints = polygonCoordinates.length;

  for (let i = 0; i < numPoints - 1; i++) {
    const xi = polygonCoordinates[i][0];
    const yi = polygonCoordinates[i][1];
    const xiplus1 = polygonCoordinates[i + 1][0];
    const yiplus1 = polygonCoordinates[i + 1][1];

    centroidX += (xi + xiplus1) * (xi * yiplus1 - xiplus1 * yi);
    centroidY += (yi + yiplus1) * (xi * yiplus1 - xiplus1 * yi);
  }

  const area = calculateArea(polygonCoordinates);

  centroidX = centroidX / (6 * area);
  centroidY = centroidY / (6 * area);
  return [centroidX, centroidY];
}

// calculate area which is required for calculating centroid
function calculateArea(polygonCoordinates) {
  let area = 0;
  const numPoints = polygonCoordinates.length;

  for (let i = 0; i < numPoints - 1; i++) {
    const xi = polygonCoordinates[i][0];
    const yi = polygonCoordinates[i][1];
    const xiplus1 = polygonCoordinates[i + 1][0];
    const yiplus1 = polygonCoordinates[i + 1][1];

    area += xi * yiplus1 - xiplus1 * yi;
  }

  area = Math.abs(area / 2);

  return area;
}

let geoJsonFilename;
let backgroundImage;

// default floor setting
geoJsonFilename = 'geojson/g.geojson';
backgroundImage ='floorPlan/g_edge.png';

heatmapContainer.style.backgroundImage = 'url('+backgroundImage+')';

let timeArray = [];

async function processGeojsonFile() {
  try {
    points = [];
    let idList = []
    let geoJsonData = NaN;
    timeArray = [];
    
    const response = await fetch(geoJsonFilename);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    geoJsonData = await response.json();
    
    for (let i = 0; i < geoJsonData.features.length; i++) {
      id = geoJsonData.features[i].properties.ID;
      if (id !== 'boundary') {
        idList.push(id);
      }
    }
    for (const id of idList) {
      await fetchData(id, geoJsonData);
    }
    
    const boundaryFeature = geoJsonData.features[geoJsonData.features.length-1];
    boundaryPolygon = boundaryFeature.geometry.coordinates[0][0];
    for (let i = 0; i < boundaryPolygon.length; i++) {
      boundaryPolygon[i][0] = parseInt(Math.abs(boundaryPolygon[i][0])); 
      boundaryPolygon[i][1] = parseInt(Math.abs(boundaryPolygon[i][1]));
    };
    let oldestTime = await updateTime();

    const oldestTimeDisplay = document.getElementById('updateTimeDisplay');
    oldestTimeDisplay.innerText = 'Last Updated Time: ' + oldestTime.toLocaleString();

    applyBoundaryMask(overlayCanvas, boundaryPolygon);
  } catch (error) {
    console.error('Error fetching GeoJSON file:', error);
  }
}

processGeojsonFile();

const canvasCircle = heatmapContainer.querySelector('canvas');
const ctxCircle = canvasCircle.getContext('2d');
ctxCircle.width= overlayCanvas.width;
ctxCircle.height = overlayCanvas.height;

// function to draw each circle
function drawCircle(x, y, radius, colour) {
    var gradient = ctxCircle.createRadialGradient(x,y,0,x,y,radius);
    const hexColor = colour.replace('#', '');
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // set the maximum opacity of the circle (centroid)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.7)`);
    // set the minimum opacity of the circle (edge)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    ctxCircle.beginPath();
    ctxCircle.arc(x, y, radius, 0, 2 * Math.PI);
    ctxCircle.fillStyle = gradient;
    ctxCircle.fill();
    ctxCircle.closePath();
}

async function fetchData(id, geoJsonData) {
  try {
    const response = await fetch(`https://<API URL>/api/api.php?id=${id}`);
    const data = await response.json();
    const hits = data.hits.hits;
    const firstHit = hits[0];
    const time = firstHit._source["@timestamp"];
    timeArray.push(time);
    const ID = firstHit._source.ID;
    firstTemperature = firstHit._source.temperature;

    for (let i = 0; i < geoJsonData.features.length; i++) {

    // getting the coordinates of the centriod of each area and append to the points array
      if (geoJsonData.features[i].properties.ID === id) {
        const polygonCoordinates = geoJsonData.features[i].geometry.coordinates[0][0];
        const centroid = calculateCentroid(polygonCoordinates);
        points.push({x: parseInt(Math.abs(centroid[0])), y: parseInt(Math.abs(centroid[1])), value: firstTemperature, id:ID});
	
	// pick the colour of the circle
	let colorIndex = -1;
	for (let j = 0; j < colours.length; j++) {
	  if (firstTemperature > colours[j].minValue && firstTemperature <= colours[j].maxValue) {
	    colorIndex = j;
	    break;
	  }
	}
	if (firstTemperature <= minValue) {
	  colorIndex = 0;
	}
	if (firstTemperature >= maxValue) {
	  colorIndex = colours.length-1;
	}
	if (colorIndex !== -1) {
	  let colorValue = colours[colorIndex].color;
	  drawCircle(parseInt(Math.abs(centroid[0])),parseInt(Math.abs(centroid[1])),radius,colorValue);
	break;
	}
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// get the earliest update time of a floor
async function updateTime() {
  let old = new Date(timeArray[0]);
  for (let i = 1; i < timeArray.length; ++i) {
    let current = new Date(timeArray[i]);
    if (current < old) {
      old = current;
    }
  }
  return old;
}

function applyBoundaryMask(canvas,boundary) {
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = backgroundImage;
  img.onload = function() {
    const pat = ctx.createPattern(img,'no-repeat');    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(boundary[0][0], boundary[0][1]);
    for (let i = 0; i < boundary.length; i++) {
      ctx.lineTo(boundary[i][0], boundary[i][1]);
    }
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = pat;
    ctx.fill()
    ctx.restore();
     
    // printing temperatures on screen
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const temperature = point.value;

      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);

      // Calculate the position to center the text
      const textWidth = 72.490234375;
      const textX = parseInt(point.x - textWidth / 2);
      const textY = parseInt(point.y);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(textX - 5, textY - 22, textWidth, 30);
      
      ctx.font = '20px Arial';
      ctx.fillStyle = 'black';

      ctx.fillText((point.value).toFixed(1) + '°C', textX, textY);
      
    }
  };
}

// settings of all floors
var run = false;
document.addEventListener("DOMContentLoaded", function() {
  async function runEvent(geoJsonFilename, backgroundImage) {
    ctxCircle.clearRect(0,0,ctxCircle.width,ctxCircle.height);
    heatmapContainer.style.backgroundImage = 'url('+backgroundImage+')';
    await processGeojsonFile();
    run = false;
  }
  
  // settings of 1/F
  document.getElementById('1Btn').addEventListener('click', function() {
    if (!run) {
      run = true;
      geoJsonFilename = 'geojson/1F.geojson';
      backgroundImage ='floorPlan/1_edge.png';
      runEvent(geoJsonFilename,backgroundImage);
    }
  });

  // settings of G/F
  document.getElementById('gBtn').addEventListener('click', function() {
    if (!run) {
      run = true;
      geoJsonFilename = 'geojson/g.geojson';
      backgroundImage ='floorPlan/g_edge.png';
      runEvent(geoJsonFilename,backgroundImage);
    }
  });

  // settings of LG1
  document.getElementById('lg1Btn').addEventListener('click', function() {
    if (!run) {
      run = true;
      geoJsonFilename = 'geojson/lg1.geojson';
      backgroundImage ='floorPlan/lg1_edge.png';
      runEvent(geoJsonFilename,backgroundImage);
    }
  });

  // settings of LG3
  document.getElementById('lg3Btn').addEventListener('click', function() {
    if (!run) {
      run = true;
      geoJsonFilename = 'geojson/lg3.geojson';
      backgroundImage ='floorPlan/lg3_edge.png';
      runEvent(geoJsonFilename,backgroundImage);
    }
  });

  // settings of LG4
  document.getElementById('lg4Btn').addEventListener('click', function() {
    if (!run) {
      run = true;
      geoJsonFilename = 'geojson/lg4.geojson';
      backgroundImage ='floorPlan/lg4_edge.png';
      runEvent(geoJsonFilename,backgroundImage);
    }
  });
});
