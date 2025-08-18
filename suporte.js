import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const apelidoLogin = document.getElementById("apelidoLogin");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const contatosSalvos = document.getElementById("contatosSalvos");
const mensagensDiv = document.getElementById("mensagens");
const novaMensagem = document.getElementById("novaMensagem");
const enviarBtn = document.getElementById("enviarBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let apelidosCache = {};

// --- Funções ---
function gerarIdConversa(email1, email2) {
  return [email1, email2].sort().join("_");
}

function salvarContato(email, apelido) {
  if (!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
  }
  carregarContatos();
}

function carregarContatos() {
  contatosSalvos.innerHTML = "";
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  contatos.forEach(c => {
    const div = document.createElement("div");
    div.textContent = c.apelido;
    div.classList.add("contato-item");
    div.onclick = () => abrirConversa(gerarIdConversa(auth.currentUser.email, c.email));
    contatosSalvos.appendChild(div);
  });
}

async function getApelido(email) {
  if (!email) return "Anônimo";
  if (apelidosCache[email]) return apelidosCache[email];
  try {
    const userDocRef = doc(db, "users", email);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists() && userDocSnap.data().nickname) {
      apelidosCache[email] = userDocSnap.data().nickname;
      return apelidosCache[email];
    }
  } catch (error) {
    console.error(error);
  }
  return email;
}

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) unsubscribeMensagens();
  conversaIdAtual = conversaId;
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async snapshot => {
    mensagensDiv.innerHTML = "";
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");
      msgEl.textContent = data.texto;

      // Menu 3 pontinhos
      const menuDots = document.createElement("div");
      menuDots.textContent = "⋮";
      menuDots.classList.add("menu-dots");

      const menuOptions = document.createElement("div");
      menuOptions.classList.add("menu-options");
      ["Apagar", "Editar", "Copiar"].forEach(op => {
        const btn = document.createElement("div");
        btn.textContent = op;
        btn.classList.add("option");
        btn.onclick = () => {
          if (op === "Apagar") {
            doc(db, "conversas", conversaId, "mensagens", docSnap.id)
              .delete().catch(console.error);
          } else if (op === "Editar") {
            novaMensagem.value = data.texto;
          } else if (op === "Copiar") {
            navigator.clipboard.writeText(data.texto);
          }
        };
        menuOptions.appendChild(btn);
      });

      menuDots.onclick = () => {
        menuOptions.style.display = menuOptions.style.display === "block" ? "none" : "block";
      };

      msgEl.appendChild(menuDots);
      msgEl.appendChild(menuOptions);

      mensagensDiv.appendChild(msgEl);
    }
    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

// --- Eventos ---
registerBtn.onclick = async () => {
  const apelido = apelidoLogin.value.trim();
  const email = emailInput.value.trim();
  const senha = passwordInput.value;
  if (!apelido || !email || !senha) return alert("Preencha todos os campos.");
  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, "users", email), { nickname: apelido });
    alert("Registrado com sucesso!");
  } catch (e) { alert(e.message); }
};

loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const senha = passwordInput.value;
  if (!email || !senha) return alert("Preencha todos os campos.");
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (e) { alert(e.message); }
};

logoutBtn.onclick = () => signOut(auth);

enviarBtn.onclick = async () => {
  const texto = novaMensagem.value.trim();
  if (!texto || !conversaIdAtual) return;
  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  await addDoc(mensagensRef, {
    texto,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
  });
  novaMensagem.value = "";
};

// --- Auth state ---
onAuthStateChanged(auth, user => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    userApelidoDisplay.textContent = apelidosCache[user.email] || user.email;
    carregarContatos();
  } else {
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});
