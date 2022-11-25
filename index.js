const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middle ware
app.use(cors());
app.use(express.json());
function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "Forbiden Token" });
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.csyc5ob.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        const userCollection = client.db('resell-bikes').collection('users');
        const categoryCollection = client.db('resell-bikes').collection('productsCategory');
        const productCollection = client.db('resell-bikes').collection('products');
        const bookingCollection = client.db('resell-bikes').collection('bookings');

        // Products
        app.get('/category', async (req, res) => {
            const query = {}
            const result = await categoryCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id }
            const result = await productCollection.find(query).toArray();
            res.send(result)
        })

        // Bookings
        app.get('/bookings', verifyJwt, async (req, res) => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Token" });
            }
            const query = { email: email };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                email: booking.email,
                item: booking.item,
            }
            const alreadybooked = await bookingCollection.find(query).toArray();
            if (alreadybooked.length) {
                const message = `Sorry Sir, you have already booked ${booking.item}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1hr' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: "" })
        })

        // Users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        })
    }
    finally { }
}
run().catch(console.log())

app.get('/', (req, res) => res.send("Resell Bikes server running"))
app.listen(port, () => console.log(`server running on ${port}`))