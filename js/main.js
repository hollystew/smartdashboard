
mapboxgl.accessToken = 'pk.eyJ1IjoiaG9sbHlzdGV3IiwiYSI6ImNta3k3cTJqcDA0YnEzY3E3eGZyOTFmazIifQ.FTqjbVJmwX5n0w6SnEKo9A';

let map = new mapboxgl.Map({
    container:'map',
    style:'mapbox://styles/mapbox/dark-v10',
    center:[-122.33,47.60],
    zoom:10
});


// Legend 

const legend = document.getElementById('legend');

// Severity colors 

const severityColors = {
    "Property Damage Only Collision": "#2a9d8f",
    "Injury Collision": "#f4a261",
    "Serious Injury Collision": "#e76f51",
    "Fatality Collision": "#d62828",
    "unknown": "#cccccc"
};

// Size grades for people involved

const sizeGrades = [1, 3, 5, 10];
const sizeRadii = [4, 8, 12, 18];

let legendHTML = "<strong>Collision Severity</strong>";

Object.entries(severityColors).forEach(([label, color]) => {

    legendHTML += `
        <p>
            <span class="dot"
                style="
                    background:${color};
                    width:12px;
                    height:12px;
                    display:inline-block;
                    border-radius:50%;
                    margin-right:6px;
                ">
            </span>
            ${label}
        </p>
    `;

});

// Legend size

legendHTML += "<br><strong>People Involved</strong>";

for (let i = 0; i < sizeGrades.length; i++) {

    let size = sizeRadii[i] * 2;

    legendHTML += `
        <p>
            <span class="dot"
                style="
                    background:gray;
                    width:${size}px;
                    height:${size}px;
                    display:inline-block;
                    border-radius:50%;
                    margin-right:6px;
                    opacity:0.6;
                ">
            </span>
            ${sizeGrades[i]}+
        </p>
    `;
}

legend.innerHTML = legendHTML;

map.on('load', async () => {

    const response = await fetch('assets/crashes2025.geojson');
    const raw = await response.json();

    const fixedData = {
        type: "FeatureCollection",
        features: raw.features.map(f => ({
            type: "Feature",
            properties: f.properties,
            geometry: {
                type: "Point",
                coordinates: [
                    parseFloat(f.properties.LONGITUDE), 
                    parseFloat(f.properties.LATITUDE)
                ]
            }
        }))
    };

    map.addSource('crashes', {
        type: 'geojson',
        data: fixedData
    });

    map.addLayer({
        id: 'crashes-points',
        type: 'circle',
        source: 'crashes',
        paint: {
            'circle-radius':[
                    'interpolate',
                    ['linear'],
                    ['to-number',['get','PERSONCOUNT']],
                    1,4,
                    2,6,
                    3,8,
                    5,12,
                    10,18
                ],
            'circle-color':[
                    'match',
                    ['get','highest_severity'],
                    'Property Damage Only Collision','#2a9d8f',
                    'Injury Collision','#f4a261',
                    'Serious Injury Collision','#e76f51',
                    'Fatality Collision','#d62828',
                    'unknown','#cccccc'
                ],

            'circle-opacity':0.7,
                'circle-stroke-color':'white',
                'circle-stroke-width':1
        }
    });

    createChart(fixedData);
    updateDashboard(fixedData);

    map.on('click','crashes-points',(e)=>{

        let p = e.features[0].properties;

        new mapboxgl.Popup()
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`
            <b>Date:</b> ${p.INCDTTM}<br>
            <b>Severity:</b> ${p.highest_severity}<br>
            <b>People:</b> ${p.PERSONCOUNT}
        `)
        .addTo(map);

    });

    map.on('idle',()=>{
        updateDashboard(fixedData);
    });

});


// Dashboard

function updateDashboard(fixedData){

    let bounds = map.getBounds();

    let count = 0;
    let severityCounts = {};

    fixedData.features.forEach(f=>{

        if(bounds.contains(f.geometry.coordinates)){

            count++;

            let sev = f.properties.highest_severity;

            severityCounts[sev] = (severityCounts[sev] || 0) + 1;
        }
    });

    let numCrashes = count;

    document.getElementById('crash-count').innerHTML = numCrashes;

    updateChart(severityCounts);
}


// Chart

function createChart(fixedData){

    crashChart = c3.generate({

        bindto:'#chart',

        data:{
            x:'x',
            columns:[],
            type:'bar',

            color: function (color, d) {

                if (d.index !== undefined && d.index !== null) {

                    let severity = crashChart.categories()[d.index];

                    if (severityColors[severity]) {
                        return severityColors[severity];
                    }
                }

                return color;
            },

            onclick:function(d){

                let severity = crashChart.categories()[d.index];

                map.setFilter('crashes-points',
                    ['==',['get','highest_severity'],severity]
                );
            }
        },

        axis:{
            x:{
                type:'category'
            }
        },

        legend:{
            show:false
        }
    });
}


function updateChart(counts){

    currentCategories = Object.keys(counts);
    let values = Object.values(counts);

    crashChart.load({
        columns: [
            ['x', ...currentCategories],
            ['Crashes', ...values]
        ]
    });
}


// Reset button

document.getElementById('reset').addEventListener('click',()=>{

    map.flyTo({
        center:[-122.33,47.60],
        zoom:10
    
    });

    map.setFilter('crashes-points',null);

});

