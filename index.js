const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
        const sellerProductCollection = client.db('resell-bikes').collection('sellerProducts');
        const bookingCollection = client.db('resell-bikes').collection('bookings');
        const paymentCollection = client.db('resell-bikes').collection('payment');

        // Seller checking
        const veryifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);

            if (user?.userType !== 'Seller') {
                return res.status(403).send({ message: "Forbidden access" })
            }
            next();
        }

        // Categories
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

        // Products
        app.post('/products', verifyJwt, veryifySeller, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            const sellerProduct = await sellerProductCollection.insertOne(product);
            res.send(result);
        })

        app.get('/products', verifyJwt, veryifySeller, async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const result = await sellerProductCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/advertiserproducts', async (req, res) => {
            const query = { advertised:true }
            const result = await productCollection.find(query).toArray();
            res.send(result);
        })

        app.patch('/products', verifyJwt, veryifySeller, async (req, res) => {
            const id = req.query.id;
            console.log(id);
            const query = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    advertised: true
                }
            }
            const result = await productCollection.updateOne(query, updatedDoc);
            const sellerProduct = await sellerProductCollection.updateOne(query, updatedDoc);
            res.send(sellerProduct);
        })

        app.delete('/products/:id', verifyJwt, veryifySeller, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await sellerProductCollection.deleteOne(query);
            const deleted = await productCollection.deleteOne(query);
            res.send(deleted);
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

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.findOne(query);
            res.send(result);
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

        app.post("/create-payment-intent", async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            const id = payment.bookingId;
            const query = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transitiond: payment.transitionId
                }
            }
            const product = payment.productId;
            const filter = { _id: ObjectId(product) }
            const deletedProduct = await productCollection.deleteOne(filter);
            const paidProduct = await sellerProductCollection.updateOne(filter, updatedDoc)
            const paymentResult = await bookingCollection.updateOne(query, updatedDoc);
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
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await userCollection.findOne(query);
            res.send({ isSeller: user?.userType === "Seller" })
        })

        app.get('/users', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await userCollection.findOne(query)
            res.send(result);
        })

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