const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const SSLCommerzPayment = require('sslcommerz-lts')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { title } = require('process');
const { default: axios } = require('axios');
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      'https://jersey-geeks.web.app'
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded());

// Payment info
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.salgcrv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    const jerseyCollection = client.db("jerseyDB").collection("jerseys");
    const cartCollection = client.db('jerseyDB').collection('carts');
    const userCollection = client.db('jerseyDB').collection('users');
    const orderCollection = client.db('jerseyDB').collection('orders');


    app.get('/jerseys', async (req, res) => {
      const email = req.query?.email;
      const search = req.query.search;
      let query = {};
      if (email) {
        query = { providerEmail: email };
      }
      if (search) {
        query = {
          title: { $regex: search, $options: 'i' }
        }
      }
      const result = await jerseyCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/club-jerseys', async (req, res) => {
      const search = req.query?.search;
      let query = {
        category: 'club'
      };
      if (search) {
        query = {
          title: { $regex: search, $options: 'i' },
          category: 'club'
        }
      }
      const result = await jerseyCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/custom-jerseys', async (req, res) => {
      const search = req.query?.search;
      let query = {
        category: 'local'
      };
      if (search) {
        query = {
          title: { $regex: search, $options: 'i' },
          category: 'local'
        }
      }
      const result = await jerseyCollection.find(query).toArray();
      res.send(result);
    })


    app.get('/jerseys/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jerseyCollection.findOne(query);
      res.send(result);
    })
    app.post('/jerseys', async (req, res) => {
      const newService = req.body;
      const result = await jerseyCollection.insertOne(newService);
      res.send(result);
    })
    app.put('/jerseys/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const jersey = req.body;
      const updateJersey = {
        $set: {
          title: jersey.title,
          category: jersey.category,
          image: jersey.image,
          price: jersey.price,
          description: jersey.description,
          fabric_quality: jersey.fabric_quality,
          available: jersey.available,
          version: jersey.version,
          sleeve: jersey.sleeve,
          design: jersey.design,
          gsm: jersey.gsm
        },
      };
      const result = await jerseyCollection.updateOne(filter, updateJersey);
      res.send(result);
    })
    app.delete('/jerseys/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jerseyCollection.deleteOne(query);
      res.send(result);
    })

    // Carts related API
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ message: 'Unauthorized Access' })
      }
      const token = authorization.split(' ')[1];
      console.log(token)
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized Access' })
        }
        req.decoded = decoded;
        next();
      })
    }
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Unauthorized' })
      }
      next();
    }

    // user related API
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden' })
      }
      const user = await userCollection.findOne({ email: email });
      let admin = false;
      if (user?.role === 'admin') {
        admin = true;
      }
      res.send({ admin })

    })
    app.post('/users', async (req, res) => {
      const user = req.body;
      const email = user.email;
      // check if user exists
      const isExist = await userCollection.findOne({ email: email })
      if (isExist) {
        return res.send({ message: 'User already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(query, updatedUser);
      res.send(result);
    })

    // jwt related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // Payment related API
    app.post('/create-payment', async (req, res) => {
      const paymentInfo = req.body;
      const { name, email, amount, address, city, district, postcode, country, number, productName } = paymentInfo
      const transaction_id = new ObjectId().toString();
      const data =
      {
        store_id: "jerse67932cc664172",
        store_passwd: "jerse67932cc664172@ssl",
        total_amount: amount,
        currency: "BDT",
        tran_id: transaction_id,
        success_url: `https://jersey-geeks-server.vercel.app/success/${transaction_id}`,
        fail_url: `https://jersey-geeks-server.vercel.app/fail/${transaction_id}`,
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        cus_name: name,
        cus_email: email,
        cus_add1: address,
        cus_city: city,
        cus_postcode: postcode,
        cus_country: "Bangladesh",
        cus_phone: number,
        shipping_method: "NO",
        product_name: "Jerseys",
        product_category: "Jersey",
        product_profile: "general",
      }
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })
        console.log('Redirecting to: ', GatewayPageURL)
      });
      const order = {
        name, email, amount, address, city, district, postcode, country, number, productName, transaction_id, paidStatus: false
      }
      const result = await orderCollection.insertOne(order)
      const deleteCart = await cartCollection.deleteMany({email: email})
    })
    app.post('/success/:tran_id', async (req, res) => {
      const tran_id = req.params.tran_id;
      console.log(tran_id);
      const result = await orderCollection.updateOne({ transaction_id: tran_id }, {
        $set:
        {
          paidStatus: true,
          deliveryStatus: "Pending"
        }
      })
      if (result.modifiedCount > 0) {
        res.redirect(`https://jersey-geeks.web.app/dashboard/payment/success/${tran_id}`)
      }
    })
    app.post('/fail/:tran_id', async (req, res) => {
      const tran_id = req.params.tran_id;
      const result = await orderCollection.deleteOne({ transaction_id: tran_id })
      if (result.deletedCount > 0) {
        res.redirect(`https://jersey-geeks.web.app/dashboard/payment/fail/${tran_id}`)
      }
    })

    // Order related database
    app.get('/orders', async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    })
    app.put('/orders/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateOrder = {
      $set: {
        deliveryStatus: "Dispatched"
      }
    };
    const result = await orderCollection.updateOne(query, updateOrder);
    res.send(result)
    })
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
  res.send('Jersey Geeks Server running');
})

app.listen(port, () => {
  console.log('Jersey Geeks running on port,', port);
})