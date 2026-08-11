require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static("."));
app.get("/", function(req, res) {
    res.send("Backend works");
});
app.post("/analyze", function (req,res){
    const clientEmail = req.body.email;
    console.log(clientEmail);
    res.json({ message: "Email received" });
});
app.listen(3000, function() {
    console.log("Server is running on port 3000");
});