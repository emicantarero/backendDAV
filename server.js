const cors = require('cors');
const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const port = 3002;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const {VertexAI} = require('@google-cloud/vertexai');
const { SessionsClient } = require("@google-cloud/dialogflow-cx");
const { LanguageServiceClient } = require("@google-cloud/language");
// Initialize Vertex with your Cloud project and location
const vertex_ai = new VertexAI({project: 'desarrollo-443721', location: 'us-central1'});

const projectId = "desarrollo-443721";
const locationId = "global";
const agentId = "f0333490-b73f-4f43-99ee-44d4a150053d";

//const { initializeApp } = require ("firebase/app");
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3002'  
}));

var urlEncodeParser = bodyParser.urlencoded({extended: true});
app.use(urlEncodeParser);
const sessionClient = new SessionsClient();
const languageClient = new LanguageServiceClient();

//Levantar el servidor
app.listen(port, () => {
    //console.log('Hola');
});

const firebaseConfig = {
    apiKey: "AIzaSyA23v0rVRGFKGyysy1p9aNhkvGtnSwWPPI",
    authDomain: "usersvanguardia.firebaseapp.com",
    projectId: "usersvanguardia",
    storageBucket: "usersvanguardia.firebasestorage.app",
    messagingSenderId: "374231299348",
    appId: "1:374231299348:web:7e1a84a4995c4220a3be01",
    measurementId: "G-HRBYX8E9HP"
};

const uri = "mongodb+srv://emicantarero:Hernandez09@backendvanguardia.wh0fa.mongodb.net/?retryWrites=true&w=majority&appName=BackendVanguardia";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function connectToDatabase() {
    try {
        await client.connect();
        await client.db("admin").command({ping: 1});
        //console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        process.exit(1);
    }
}

connectToDatabase();

function generateToken(user) {
    return jwt.sign(
     {
      email: user.email,
     },
     "12345",
     {
      expiresIn: "1h",
     }
    );
}

app.post("/webhook", async (req, res) => {
    const { message } = req.body; // Mensaje del usuario
  
    try {
      // Llama a Dialogflow CX con el mensaje del usuario
      const dialogflowResponse = await detectIntentDialogflowCX(message);
  
      // Devuelve la respuesta del bot a la app o Postman
      res.json({
        fulfillmentText: dialogflowResponse.fulfillmentText,
        responseMessages: dialogflowResponse.responseMessages,
      });
    } catch (error) {
      console.error("Error en el webhook de Dialogflow:", error);
      res.status(500).send("Error en el servidor");
    }
  });
  
  // Función para detectar la intención en Dialogflow
  async function detectIntentDialogflowCX(messageText) {
    const sessionPath = sessionClient.projectLocationAgentSessionPath(
      projectId,
      locationId,
      agentId,
      "session-id" // Puedes generar uno por cada usuario
    );
  
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: messageText,
        },
        languageCode: "es",
      },
    };
  
    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;
  
    return {
      fulfillmentText: result.responseMessages[0]?.text?.text[0] || "",
    };
  }

app.post("/registrar", async (req, res) => {
    try {
        const database = client.db("DAV");
        const usuario = database.collection("Usuarios");
        const camposTexto = ['nombre', 'nUsuario', 'email', 'password',];
        for (const campo of camposTexto) {
            if (
                !req.body[campo] ||
                req.body[campo] === "" ||
                req.body[campo] === undefined
            ) {
                return res
                    .status(400)
                    .send(`El campo ${campo} es requerido`);
            }
        }
        const userExistente = await usuario.findOne({
        email: req.body.email,
        });
        if (userExistente) {
            return res
                .status(400)
                .send("Este email ya está asociado a otro usuario, por favor inicie sesión");
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const doc = {
            ...req.body,
            password: hashedPassword,
        };

        const result = await usuario.insertOne(doc);

        return res.status(200).send("Usuario se creó exitosamente");

    } catch (error) {
        
    }
});

app.post("/iniciarSesion", async (req, res) => {
    try{
        const database = client.db("DAV");
        const usuarios = database.collection("Usuarios");
        const camposTexto = ['email', 'password', ];
        for (const campo of camposTexto) {
            if (
                !req.body[campo] ||
                req.body[campo] === "" ||
                req.body[campo] === undefined
            ) {
                return res
                    .status(400)
                    .send(`El campo ${campo} es requerido`);
            }
        }
        const usuarioExistente = await usuarios.findOne({email: req.body.email});
        if (usuarioExistente.nUsuario != null){
            const compararPassword = await bcrypt.compare(req.body.password, usuarioExistente.password);   
            if(compararPassword){
                const token = generateToken(usuarioExistente);
                console.log(token);
                return res.status(200).send("Inicio de sesión exitoso");    
            }else{
                return res.status(400).send("Las credenciales ingresadas no coinciden");
            }
        }else{
            return res.status(404).send("Usuario no encontrado");
        }
    }catch(error){

    }
});

process.on("SIGINT", async () => {
    try {
        console.log("Deteniendo la aplicación...");
        await client.close();
        console.log("Cliente de MongoDB cerrado correctamente");
        process.exit(0);
    } catch (error) {
        console.error("Error al cerrar el cliente de MongoDB", error);
        process.exit(1);
    }
});