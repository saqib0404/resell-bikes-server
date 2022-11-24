const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const jwt = require('jsonwebtoken');
require('dotenv').config();
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const app = express();

// middle ware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.csyc5ob.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        const userCollection = client.db('resell-bikes').collection('users');

        app.post('/users', async (req, res) => {
            const user = req.body;
            const userInfo = await userCollection.insertOne(user);
            res.send(userInfo);
        })
    }
    finally { }
}
run().catch(console.log())

app.get('/', (req, res) => res.send("Resell Bikes server running"))
app.listen(port, () => console.log(`server running on ${port}`))