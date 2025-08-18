import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, doc, setDoc, getDoc, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const userEmailSpan = document.getElementById("userEmail");
const chatBox = document.getElementById("chat-box");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const chamadosListContainer = document.getElementById("chamadosListContainer");
const chamadosList = document.getElementById("chamadosList");

let conversaIdAtual = null;
let unsubscribeMensagens = null;

async function abrirChamado(chamadoId) {
  conversaIdAtual = chamadoId;
  if (unsubscribeMensagens) unsubscribeMensagens();
  chatBox.innerHTML = "";

  const mensagensRef = collection(db, "chamados", conversaIdAtual, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, snapshot => {
    chatBox.innerHTML = "";

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const msgEl = document.createElement("div");

      if (data.usuario === auth.currentUser.email || data.usuario === "atendente") {
        msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");
        msgEl.textContent = `${data.usuario}: ${data.texto}`;
        chatBox.appendChild(msgEl);
      }
    });

    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

function listarChamadosAtendente(emailAtendente) {
  const chamadosRef = collection(db, "chamados");
  const q = query(chamadosRef, where("atendentes", "array-contains", emailAtendente));

  onSnapshot(q, snapshot => {
    chamadosList.innerHTML = "";
    if (snapshot.empty) {
      const li = document.createElement("li");
      li.textContent = "Nenhum chamado disponível";
      chamadosList.appendChild(li);
      return;
    }
    snapshot.docs.forEach(docSnap => {
      const li = document.createElement("li");
      li.textContent = docSnap.id;
      li.style.cursor = "pointer";
      li.onclick = () => abrirChamado(docSnap.id);
      chamadosList.appendChild(li);
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch (e) { alert("Erro no login: " + e.message); }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", email), { tipo: "cooperado" }, { merge: true });

    const atendentes = [
      "rossato.pedrinho@gmail.com",
      "Amandasa0210@gmail.com",
      "gustazin.2501.albuquerque@gmail.com"
    ];

    await setDoc(doc(db, "chamados", email), {
      status: "aberto",
      cooperado: email,
      atendentes: atendentes
    });

    abrirChamado(email);
    chamadosListContainer.style.display = "none";
    alert("Cadastro realizado e chat criado automaticamente!");
  } catch (e) {
    alert("Erro no cadastro: " + e.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  if (unsubscribeMensagens) unsubscribeMensagens();
  conversaIdAtual = null;
  chatBox.innerHTML = "";
  chamadosList.innerHTML = "";
});

btnSend.addEventListener("click", async () => {
  if (!conversaIdAtual) { alert("Selecione um chamado"); return; }
  const msg = inputMsg.value.trim();
  if (!msg) return;

  try {
    const mensagensRef = collection(db, "chamados", conversaIdAtual, "mensagens");

    const userDoc = await getDoc(doc(db, "users", auth.currentUser.email));
    const tipo = userDoc.exists() ? userDoc.data().tipo : "cooperado";

    if (tipo === "cooperado") {
      await addDoc(mensagensRef, {
        texto: msg,
        usuario: auth.currentUser.email,
        destinatarios: ["atendentes"],
        timestamp: serverTimestamp()
      });
    } else {
      await addDoc(mensagensRef, {
        texto: msg,
        usuario: "atendente",
        destinatarios: [conversaIdAtual],
        timestamp: serverTimestamp()
      });
    }

    inputMsg.value = "";
  } catch (e) {
    console.error("Erro ao enviar mensagem:", e);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    userEmailSpan.textContent = user.email;

    const userDoc = await getDoc(doc(db, "users", user.email));
    const tipo = userDoc.exists() ? userDoc.data().tipo : "cooperado";

    if (tipo === "cooperado") {
      const chamadoRef = doc(db, "chamados", user.email);
      const chamadoSnap = await getDoc(chamadoRef);

      if (!chamadoSnap.exists()) {
        const atendentes = [
          "rossato.pedrinho@gmail.com",
          "Amandasa0210@gmail.com",
          "gustazin.2501.albuquerque@gmail.com"
        ];

        await setDoc(chamadoRef, {
          status: "aberto",
          cooperado: user.email,
          atendentes: atendentes
        });
      }

      chamadosListContainer.style.display = "none";
      abrirChamado(user.email);

    } else {
      chamadosListContainer.style.display = "block";
      listarChamadosAtendente(user.email);
    }
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
    conversaIdAtual = null;
  }
});
