import e from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";
import "dotenv/config";

// initialization app
const app = e();
const port = process.env.PORT || 5000;

// middleware
app.use(e.json());
app.use(cors());

// connection uri
const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.tvnzs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // all database and collection names
    const bookCollections = client.db("librario").collection("books");

    // api for all books
    app.get("/books", async (req, res) => {
      const books = await bookCollections.find().toArray();
      res.send(books);
    });

    // api for popular books
    app.get("/books/popular", async (req, res) => {
      const query = { rating: { $gt: 4.7 } };
      const book = await bookCollections.find(query).limit(6).toArray();
      res.send(book);
    });

    // api for category based books
    app.get("/books/category", async (req, res) => {
      const categoryName = req.query.name;
      const query = { category: categoryName };
      const books = await bookCollections.find(query).toArray();
      res.send(books);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
