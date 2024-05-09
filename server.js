const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const app = express();
const path = require("path");
const fs = require('fs');

const port = 5055;
let DRIVER_ID = ""

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.set("views", path.join(__dirname, "views"));

const multer = require('multer');

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads')
	},
	filename: (req, file, cb) => {
		cb(null, file.fieldname + '-' + Date.now())
	}
});

const upload = multer({ storage: storage });

const mongoURI =
  "mongodb+srv://project2:k07sM0wvTisyNDm3@project2.ytzyx5a.mongodb.net/?retryWrites=true&w=majority";
const mongoOptions = { useNewUrlParser: true, useUnifiedTopology: true };

const connectToDatabase = async () => {
  try {
    await mongoose.connect(mongoURI, mongoOptions);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log("Error connecting to the database ");
  }
};

// Driver schema/model
const driverSchema = new mongoose.Schema({
  username: String,
  password: String,
  fullname: String,
  vehiclemodel: String,
  vehiclecolor: String,
  licenseplate: String,
});

const Driver = mongoose.model("driver_collection", driverSchema);

// Order schema/model
const orderSchema = new mongoose.Schema({
  customerName: String,
  deliveryAddress: String,
  itemsOrdered: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "menuItem",
    },
  ],
  dateTime: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["RECEIVED", "READY FOR DELIVERY", "IN TRANSIT", "DELIVERED"],
    default: "RECEIVED",
  },
  totalWithTax: Number,
  driverName: String,
  licensePlate: String,
  deliveryImg: {
    data: Buffer,
    contentType: String
  },
});

const Order = mongoose.model("Orders_collection", orderSchema);

app.get("/", async (req, res) => {
  try {
    console.log("Reached end point / ");
    return res.render("login.ejs", {error: false});
  } catch (error) {
    console.log("Error rendering template: " +  error);
    return res.send("Error with the / endpoint");
  }
});

app.post("/login", async (req, res) => {
  try {
    const userName = req.body.userName;
    const password = req.body.password;

    const driver = await Driver.findOne({username: userName, password: password});
    
    if (driver) {
      DRIVER_ID = driver._id;
      return res.render("index.ejs", {error: false, fullName: driver.fullname, vehicleModel: driver.vehiclemodel, licensePlate: driver.licenseplate});
    }

    return res.render("login.ejs", {error: true});
    
  } catch (error) {
    console.log("Error rendering login form: " + error);
    return res.send("Error in the /login endpoint");
  }
});

app.post("/register", async (req, res) => {
  try {
    const userName = req.body.userName;
    const password = req.body.password;
    const fullName = req.body.fullName;
    const vehicleModel = req.body.vehicleModel;
    const vehicleColor = req.body.vehicleColor;
    const licensePlate = req.body.licensePlate;

    await new Driver({ 
      username: userName, 
      password: password, 
      fullname: fullName, 
      vehiclemodel: vehicleModel, 
      vehiclecolor: vehicleColor, 
      licenseplate: licensePlate }).save();

    const driver = await Driver.findOne({username: userName, password: password});
    DRIVER_ID = driver._id; 
    return res.render("index.ejs", { fullName: driver.fullname, vehicleModel: driver.vehiclemodel, licensePlate: driver.licenseplate});
  } catch (error) {
    console.log("Error rendering register: " + error);
    return res.send("Error in the /register endpoint");
  }
});

app.get("/open-orders", async (req, res) => {
  try {
    const order = await Order.find({status: 'READY FOR DELIVERY'});
    return res.render("open-orders.ejs", { orders: order });
  } catch (error) {
    console.log("Error rendering open orders form: " + error);
    res.send("Error rendering open orders form");
  }
});

app.post("/accept-order/:docid", async (req, res) => {
  try {
    const driver = await Driver.findOne({_id: DRIVER_ID});
    await Order.findByIdAndUpdate(req.params.docid, {status: 'IN TRANSIT', driverName: driver.fullname, licensePlate: driver.licenseplate}, {new: true});
    return res.redirect("/open-orders");
  } catch (error) {
    console.log("Error in accept order: " + error);
    res.send("Error in accept order");
  }
});

app.get("/delivery-fulfillment", async (req, res) => {
  try {
    const driver = await Driver.findOne({_id: DRIVER_ID});
    const order = await Order.find({status: 'IN TRANSIT', driverName: driver.fullname});
    return res.render("delivery-fulfillment.ejs", { orders: order });
  } catch (error) {
    console.log("Error rendering delivery fulfuillment form  " + error);
    res.send("Error rendering order form");
  }
});

app.post("/complete-order/:docid", upload.single('image'), async (req, res) => {
  try {
    const driver = await Driver.findOne({_id: DRIVER_ID});

    const deliveryimg = {
        data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
        contentType: req.file.mimetype
    }
    
    await Order.findByIdAndUpdate(req.params.docid, {status: 'DELIVERED', deliveryImg: deliveryimg}, {new: true});
    return res.redirect("/delivery-fulfillment");
  } catch (error) {
    console.log("Error rendering complete order form: " + error);
    res.send("Error rendering order form");
  }
});

app.listen(port, async () => {
  console.log(`Server is Running at port ${port}`);
  await connectToDatabase();
});