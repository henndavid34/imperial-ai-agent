const analyzeBtn = document.getElementById("analyzeBtn");
const emailInput = document.getElementById("emailInput");
const resultSection = document.getElementById("resultSection");
const inputScreen = document.getElementById("inputScreen");
const dayCardTitle = document.querySelector(".dayCardTitle");
const itineraryContainer = document.querySelector(".itineraryContainer");

const aiResponse = `[
    {
        "title": "Day 1 - Singapore → Milan",
        "rows": [
            {
                "place": "Milan Airport",
                "time": "09:30",
                "schedule": "Meet & greet by local guide",
                "distance": "50 km"
            }
        ]
    },
    {
        "title": "Day 2 - Milan → Lake Garda",
        "rows": [
            {
                "place": "Milan",
                "time": "Morning",
                "schedule": "Depart for Lake Garda",
                "distance": "140 km"
            }
        ]
    }
]`;

const itinerary = JSON.parse(aiResponse);

const tableHeaders = [
    "Place",
    "Time",
    "Schedule",
    "Distance"
];

tableHeaders.forEach(function(header){
    const th = document.createElement("th");
    th.textContent = header;
});

analyzeBtn.addEventListener("click",  async function () {
    const clientEmail = emailInput.value;
    console.log(clientEmail);
    if (clientEmail === "") {
        alert("Please paste the client's email before analyzing.");
        return;
    }
    const response = await fetch("http://localhost:3000/analyze",{
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            email: clientEmail
        })
    });
    const data = await response.json();
    console.log(data);
    itinerary.forEach(function(day) {
    renderDay(day);
    });
    resultSection.classList.remove("hidden");
    inputScreen.classList.add("hidden");
});

function renderDay(day){
    const dayCard = document.createElement("div");
    dayCard.classList.add("dayCard");
    const titleRow = document.createElement("h2");
    titleRow.textContent = day.title;
    titleRow.classList.add("dayCardTitle");
    const dayTable = document.createElement("table");
    dayTable.classList.add("itineraryTable");
    const tableHead = document.createElement("thead");
    const tableHeadRow = document.createElement("tr");
    tableHeaders.forEach(function(header) {
        const th = document.createElement("th");
        th.textContent = header;
        tableHeadRow.appendChild(th);
    });
    tableHead.appendChild(tableHeadRow);
    const itineraryBody = document.createElement("tbody");
    dayTable.appendChild(tableHead);
    dayTable.appendChild(itineraryBody);
    dayCard.appendChild(titleRow);
    dayCard.appendChild(dayTable);
    itineraryContainer.appendChild(dayCard);
    day.rows.forEach(function(row) {
        const tableRow = document.createElement("tr");
        const placeCell = document.createElement("td");
        const timeCell = document.createElement("td");
        const scheduleCell = document.createElement("td");
        const distanceCell = document.createElement("td");
        tableRow.appendChild(placeCell);
        tableRow.appendChild(timeCell);
        tableRow.appendChild(scheduleCell);
        tableRow.appendChild(distanceCell);  
        const placeInput = document.createElement("input");
        placeInput.classList.add("tableInput");
        placeInput.type = "text";
        placeInput.value = row.place;
        placeCell.appendChild(placeInput);
        const timeInput = document.createElement("input");
        timeInput.classList.add("tableInput");
        timeInput.type = "text";
        timeInput.value = row.time;
        timeCell.appendChild(timeInput);
        const scheduleInput = document.createElement("textarea");
        scheduleInput.classList.add("tableTextarea");
        scheduleInput.value = row.schedule;
        scheduleCell.appendChild(scheduleInput);
        const distanceInput = document.createElement("input");
        distanceInput.classList.add("tableInput");
        distanceInput.type = "text";
        distanceInput.value = row.distance;
        distanceCell.appendChild(distanceInput);
        itineraryBody.appendChild(tableRow); 
    });
};

