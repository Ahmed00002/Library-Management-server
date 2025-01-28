import e from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

// initialization app
const app = e();
const port = process.env.PORT || 5000;

// middleware
app.use(e.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

// jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.user = decoded;
    next();
  });
};

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
    const borrowedBookCollections = client
      .db("librario")
      .collection("borrowedBooks");

    //   jwt token generate
    app.post("/jwt", (req, res) => {
      const playload = req.body;

      const token = jwt.sign(playload, process.env.JWT_ACCESS_KEY, {
        expiresIn: "5h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .status(200)
        .send({ success: true, message: "login successful" });
    });

    // api for all books
    app.get("/books", async (req, res) => {
      const filter = req.query.filter;

      if (filter && filter === "true") {
        const query = { quantity: { $gt: 0 } };
        const books = await bookCollections.find(query).toArray();
        res.send(books);
      } else {
        const books = await bookCollections.find().toArray();
        res.send(books);
      }
    });

    // api for popular books
    app.get("/books/popular", async (req, res) => {
      const query = { rating: { $gt: 3.9 } };
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

    // api for single book data
    app.get("/books/:id", verifyToken, async (req, res) => {
      const id = req.params?.id;

      if (ObjectId.isValid(id)) {
        try {
          const query = { _id: new ObjectId(id) };
          const bookData = await bookCollections.findOne(query);
          res.send(bookData);
        } catch (e) {
          res.status(500).send({ message: "an error occured" });
        }
      } else {
        res.status(400).send({ message: "invalid ID format" });
      }
    });

    // api for get borrowed book data for specific user
    app.get("/user/borrowed", verifyToken, async (req, res) => {
      const email = req.query?.email;
      const decodedEmail = req.user.email;
      const validate = req.query?.validate;
      const bookId = req.query?.bookId;

      if (decodedEmail === email) {
        if (validate) {
          const query = {
            userEmail: email,
            borrowedBookId: new ObjectId(bookId),
          };
          const result = await borrowedBookCollections.find(query).toArray();
          res.send(result);
        } else {
          const query = { userEmail: email };
          const result = await borrowedBookCollections.find(query).toArray();
          res.send(result);
        }
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    // update book data
    app.post("/books/update/:id", async (req, res) => {
      const id = req.params.id;
      const newData = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          image: newData.image,
          title: newData.title,
          author: newData.author,
          category: newData.category,
          rating: parseFloat(newData.rating),
          description: newData.description,
          quantity: parseInt(newData.quantity),
        },
      };
      const updated = await bookCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(updated);
    });

    // api for borrow books
    app.post("/books/borrow/:id", verifyToken, async (req, res) => {
      const borrowedBookId = req.params.id;
      const data = req.body;
      const today = new Date().toISOString().split("T")[0];
      data.borrowData = today;
      data.borrowedBookId = new ObjectId(borrowedBookId);

      const filter = { _id: new ObjectId(borrowedBookId) };
      const updateDoc = {
        $inc: {
          quantity: -1,
        },
      };
      const options = { upsert: true };

      const result = await borrowedBookCollections.insertOne(data);
      const updated = await bookCollections.updateOne(
        filter,
        updateDoc,
        options
      );

      res.send(result);
    });

    // api for returning books
    app.get("/return", verifyToken, async (req, res) => {
      const borrowedId = req.query.bbId; //borrowed book id
      const currentId = req.query.cbId; //current data id
      const email = req.query.email; // user email
      const query = { _id: new ObjectId(currentId), userEmail: email }; //query for getting the correct borrowed book id
      const filter = { _id: new ObjectId(borrowedId) };
      const updateDoc = {
        $inc: {
          quantity: +1,
        },
      };
      const options = { upsert: true };
      const result = await borrowedBookCollections.deleteOne(query);
      const update = await bookCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // api for adding new book
    app.post("/book/add", verifyToken, async (req, res) => {
      const reqBody = req.body;
      const bookData = {
        image: reqBody.image,
        title: reqBody.title,
        author: reqBody.author,
        category: reqBody.category,
        rating: parseFloat(reqBody.rating),
        description: reqBody.description,
        quantity: parseInt(reqBody.quantity),
      };

      const result = await bookCollections.insertOne(bookData);
      res.send(result);
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
