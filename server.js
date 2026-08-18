require("dotenv").config();
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

        For the first row of each day, use "N/A" for distance
        because it is the starting point of that day.

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
    for (const day of parsedResponse.itinerary){
        for (let i = 1; i < day.rows.length; i++) {
            const startPlace = day.rows[i-1].routingPlace;
            const endPlace = day.rows[i].routingPlace;
            const startCoordinates = await getCoordinates(startPlace);
            const endCoordinates = await getCoordinates(endPlace);
            if (!startCoordinates || !endCoordinates) {
                day.rows[i].distance = "N/A";
                continue;
            }
            const tomTomDistance = await getDistance(startCoordinates, endCoordinates);
            day.rows[i].distance = `${tomTomDistance.toFixed(1)} km`;
        };
    };
    res.json({
        itinerary: JSON.stringify(parsedResponse)
    });

});
app.listen(3000, function() {
    console.log("Server is running on port 3000");
});