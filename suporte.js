import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const userEmailSpan = document.getElementById("userEmail");
const chatBox = document.getElementById("chat-box");

const friendEmailInput = document.getElementById("friendEmail");
const startChatBtn = document.getElementById("startChatBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;

function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join('_');
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Cadastro realizado com sucesso! Você já está logado.");
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth);
  if (unsubscribeMensagens) {
    unsubscribeMensagens();
  }
  conversaIdAtual = null;
  chatBox.innerHTML = "";
  friendEmailInput.value = "";
});

startChatBtn.addEventListener("click", () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const usuario = auth.currentUser.email.toLowerCase();

  if (amigo === "" || amigo === usuario) {
    alert("Digite um email válido e diferente do seu.");
    return;
  }

  conversaIdAtual = gerarIdConversa(usuario, amigo);
  abrirConversa(conversaIdAtual);
});

document.getElementById("btn-send").addEventListener("click", async () => {
  if (!conversaIdAtual) {
    alert("Abra uma conversa antes de enviar mensagens.");
    return;
  }

  const msg = document.getElementById("input-msg").value.trim();
  if (msg === "") return;

  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  await addDoc(mensagensRef, {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp()
  });

  document.getElementById("input-msg").value = "";
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "block";
    userEmailSpan.textContent = user.email;
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
    conversaIdAtual = null;
    if (unsubscribeMensagens) {
      unsubscribeMensagens();
    }
    chatBox.innerHTML = "";
    friendEmailInput.value = "";
  }
});

function abrirConversa(conversaId) {
  if (unsubscribeMensagens) {
    unsubscribeMensagens();
  }

  chatBox.innerHTML = "";
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const msgEl = document.createElement("p");
      msgEl.classList.add("msg");
      msgEl.style.background = data.usuario === auth.currentUser.email ? "#e1ffc7" : "#c7dfff";
      msgEl.style.padding = "5px";
      msgEl.style.borderRadius = "5px";
      msgEl.style.marginBottom = "5px";
      msgEl.textContent = `${data.usuario}: ${data.texto}`;
      chatBox.appendChild(msgEl);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}
