require("dotenv").config();
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const OpenAI = require("openai"); 
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY
 });
const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static("."));
app.get("/", function(req, res) {
    res.send("Backend works");
});

async function getCoordinates(place) {
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(place)}.json?countrySet=IT&key=${process.env.TOMTOM_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
    console.log("No location found:", place);
    return null;
    }
    console.log(place, data.results[0].position);
    console.log(data.results[0].address?.freeformAddress);
    return data.results[0].position;
};
async function getDistance(start, end) {
    const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json?key=${process.env.TOMTOM_API_KEY}&travelMode=truck&vehicleCommercial=true`;
    const response = await fetch(routeUrl);
    const data = await response.json();
    console.log(response.status);
    console.log(data);
    return data.routes[0].summary.lengthInMeters / 1000; // Convert meters to kilometers
};
app.post("/analyze", async function (req,res){
    const clientEmail = req.body.email;
    const validityMatch = clientEmail.match(
        /Validity:\s*(\d{1,2})\.(\d{1,2}).*?(\d{4})/i
    );
    const startDay = validityMatch ? Number(validityMatch[1]) : null;
    const startMonth = validityMatch ? Number(validityMatch[2]) : null;
    const startYear = validityMatch ? Number(validityMatch[3]) : null;
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const monthName = startDate.toLocaleString("en-US", { month: "short" });
    const firstTitle = `Day 1 - ${monthName} ${startDay}`;
    console.log(clientEmail);
    const response = await openai.responses.create({
    model: "gpt-5.5",

    input: `
        You are a travel itinerary assistant.
        Analyze the following client email and convert it into the required itinerary structure.
        If you estimate a value that was not explicitly stated in the email,
        add the field name to "estimatedFields".
        If time or distance is not explicitly stated in the email,
        estimate a reasonable value based on the itinerary.
        For each row, set "distance" to the estimated distance
        from the previous row's place to the current row's place.
        Use only the distance value, for example "50 km".
        If a row represents a transfer with a driving distance of 10 km or more,
        write the schedule in the format:
        "LDC Transfer to [destination]"
        Do not write "LDC" anywhere else.
        Do not append it to the end of the schedule.
        For the first row of each day, leave "distance" as an empty string
        because it is the starting point of that day.
        If there is no meaningful travel distance between two rows, leave "distance" as an empty string.
        Do not use "N/A" or "0 km".
        For every following row, calculate the distance
        from the previous row's place to the current row's place.
        For each row, set "routingPlace" to a location name optimized for map routing.
        Include the city and country whenever possible.
        Use the itinerary context to disambiguate locations.
        For example:
        "Duomo Square" in a Milan itinerary should become
        "Duomo Square, Milan, Italy".
        If multiple rows refer to the same hotel or location,
        use the same routingPlace for those rows.
        Do not invent a specific hotel, restaurant or address if it is not provided.
        If only the city is known, use the city as the routingPlace.    
        Only fill "place" when the row refers to a real geographic location, venue, hotel, airport, city, attraction or restaurant.
        If the row only describes an activity or program such as "Luxury shopping", "Free time", "Dinner", "Sightseeing" or similar, leave "place" as an empty string and put the activity only in "schedule".
        Do not repeat the same activity text in both "place" and "schedule".
        Estimate the "time" field when it is not explicitly stated.
        Use the first known or estimated departure time as the start of the day.
        The total daily program should not exceed 12 hours from the start of the day.
        Between the end of one day and the start of the next day, allow at least 11 hours of rest.
        All estimated times should remain editable by the user.

        Client email:
        ${clientEmail}
        `,

            text: {
            format: {
                    type: "json_schema",
                    name: "itinerary",
                    strict: true,

                    schema: {
                        type: "object",

                        properties: {
                            itinerary: {
                                type: "array",

                                items: {
                                    type: "object",

                                    properties: {
                                        title: {
                                        type: "string"
                                        },

                                        rows: {
                                            type: "array",

                                            items: {
                                                type: "object",

                                                properties: {
                                                    place: {
                                                        type: "string"
                                                    },

                                                    routingPlace: {
                                                        type: "string"
                                                    },

                                                    time: {
                                                        type: "string"
                                                    },

                                                    schedule: {
                                                        type: "string"
                                                    },

                                                    distance: {
                                                        type: "string"
                                                    },

                                                    estimatedFields: {
                                                        type: "array",
                                                        items: {
                                                            type: "string"
                                                        }
                                                    }
                                                },

                                                required: [
                                                    "place",
                                                    "routingPlace",
                                                    "time",
                                                    "schedule",
                                                    "distance",
                                                    "estimatedFields"
                                                ],

                                                additionalProperties: false
                                            }
                                        }
                                    },

                                    required: [
                                        "title",
                                        "rows"
                                    ],

                                    additionalProperties: false
                                }
                            }
                        },

                        required: [
                            "itinerary"
                        ],

                        additionalProperties: false
                    }
                }
            }
        });

    console.log("OUTPUT:", response.output_text);
    const parsedResponse = JSON.parse(response.output_text);
    for (let index = 0; index < parsedResponse.itinerary.length; index++) {
        const day = parsedResponse.itinerary[index];
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + index);
        const currentMonthName = currentDate.toLocaleString("en-US", { month: "short" });
        const currentDay = currentDate.getDate();
        day.title = `Day ${index + 1} - ${currentMonthName} ${currentDay}`;
    
        for (let i = 1; i < day.rows.length; i++) {
            const startPlace = day.rows[i-1].routingPlace;
            const endPlace = day.rows[i].routingPlace;
            const startCoordinates = await getCoordinates(startPlace);
            const endCoordinates = await getCoordinates(endPlace);
            if (!startCoordinates || !endCoordinates) {
                day.rows[i].distance = "";
                continue;
            }
            const tomTomDistance = await getDistance(startCoordinates, endCoordinates);
            const roundedDistance = Math.round(tomTomDistance / 5) * 5;
            if (roundedDistance === 0) {
                day.rows[i].distance = "";
            } else {
                day.rows[i].distance = `${roundedDistance} km`;
            }
        };
    };
    res.json({
        itinerary: JSON.stringify(parsedResponse)
    });

});

app.post("/generate-word", function (req, res) {
    try {
        console.log(req.body.itinerary);
        const templatePath = path.join(__dirname, "docs", "TEMPLATE OFFER.docx");
        const templateContent = fs.readFileSync(templatePath);

        const zip = new PizZip(templateContent);
        const doc = new Docxtemplater(zip);

        doc.render({
            itinerary: req.body.itinerary.itinerary
        });

        const buffer = doc.getZip().generate({
            type: "nodebuffer"
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=generated_offer.docx"
        );

        console.log("Template opened for Word generation");
        res.send(buffer);
    } catch (error) {
      console.log(error);
    }
});

app.listen(3000, function() {
    console.log("Server is running on port 3000");
});