import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
const typingIndicator = document.getElementById("typingIndicator");

const friendEmailInput = document.getElementById("friendEmail");
const startChatBtn = document.getElementById("startChatBtn");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");

const contatosSalvosSelect = document.getElementById("contatosSalvos");

const nicknameModal = document.createElement("div");
nicknameModal.id = "nicknameModal";
nicknameModal.style = `
  position: fixed; top:0; left:0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
`;
nicknameModal.innerHTML = `
  <div style="background:#fff; padding:20px; border-radius:8px; max-width:320px; width:90%; box-shadow:0 2px 10px rgba(0,0,0,0.3); text-align:center;">
    <h3>Escolha um apelido</h3>
    <input type="text" id="nicknameInput" placeholder="Digite seu apelido" style="width:100%; padding:8px; margin-bottom:12px; font-size:16px;"/>
    <button id="saveNicknameBtn" style="padding:10px 20px; font-size:16px;">Salvar</button>
  </div>
`;
document.body.appendChild(nicknameModal);
nicknameModal.style.display = "none";

const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;
let apelidosCache = {};
let respostaMsg = null;

function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function atualizarDigitando(status) {
  if (!conversaIdAtual || !auth.currentUser) return;
  const conversaRef = doc(db, "conversas", conversaIdAtual);

  try {
    await setDoc(
      conversaRef,
      {
        [`digitando_${auth.currentUser.email}`]: status,
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Erro ao atualizar digitando:", error);
  }
}

function resetDigitandoTimeout() {
  if (digitandoTimeout) clearTimeout(digitandoTimeout);
  digitandoTimeout = setTimeout(() => {
    atualizarDigitando(false);
  }, 1500);
}

function carregarContatos() {
  const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach((email) => {
      const option = document.createElement("option");
      option.value = email;
      option.textContent = email;
      contatosSalvosSelect.appendChild(option);
    });
  } else {
    contatosSalvosSelect.style.display = "none";
    contatosSalvosSelect.innerHTML = "";
  }
}

contatosSalvosSelect.addEventListener("change", () => {
  const selecionado = contatosSalvosSelect.value;
  if (selecionado) {
    friendEmailInput.value = selecionado;
  } else {
    friendEmailInput.value = "";
  }
});

function salvarContato(email) {
  if (!email) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.includes(email)) {
    contatos.push(email);
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
}

async function salvarApelido(apelido) {
  if (!auth.currentUser) return;
  apelidosCache[auth.currentUser.email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  try {
    const userDocRef = doc(db, "users", auth.currentUser.email);
    await setDoc(userDocRef, { nickname: apelido }, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar apelido no Firestore:", error);
  }
}

async function carregarApelidosCache() {
  const cacheLocal = localStorage.getItem("apelidosCache");
  apelidosCache = cacheLocal ? JSON.parse(cacheLocal) : {};
}

async function buscarApelidoFirestore(email) {
  if (apelidosCache[email]) return apelidosCache[email];
  try {
    const userDocRef = doc(db, "users", email);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      if (data.nickname) {
        apelidosCache[email] = data.nickname;
        localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
        return data.nickname;
      }
    }
  } catch (error) {
    console.error("Erro ao buscar apelido no Firestore:", error);
  }
  return email; // fallback
}

async function getApelido(email) {
  if (!email) return "Anônimo";
  if (apelidosCache[email]) return apelidosCache[email];
  return await buscarApelidoFirestore(email);
}

function mostrarNicknameModal() {
  nicknameModal.style.display = "flex";
  nicknameInput.value = apelidosCache[auth.currentUser.email] || "";
  nicknameInput.focus();
}

function esconderNicknameModal() {
  nicknameModal.style.display = "none";
}

saveNicknameBtn.addEventListener("click", async () => {
  const apelido = nicknameInput.value.trim();
  if (apelido.length < 2) {
    alert("Digite um apelido com pelo menos 2 caracteres.");
    return;
  }
  await salvarApelido(apelido);
  userEmailSpan.textContent = apelido;
  esconderNicknameModal();
});

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

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  if (unsubscribeMensagens) unsubscribeMensagens();
  if (unsubscribeTyping) unsubscribeTyping();
  conversaIdAtual = null;
  chatBox.innerHTML = "";
  friendEmailInput.value = "";
  typingIndicator.textContent = "";
  btnSend.disabled = true;
  inputMsg.disabled = true;
  esconderNicknameModal();
});

startChatBtn.addEventListener("click", () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const usuario = auth.currentUser.email.toLowerCase();

  if (amigo === "" || amigo === usuario) {
    alert("Digite um email válido e diferente do seu.");
    return;
  }

  const novaConversaId = gerarIdConversa(usuario, amigo);

  if (conversaIdAtual === novaConversaId) return;

  conversaIdAtual = novaConversaId;
  abrirConversa(conversaIdAtual);
  btnSend.disabled = false;
  inputMsg.disabled = false;

  salvarContato(amigo);
});

btnSend.addEventListener("click", async () => {
  if (!conversaIdAtual) {
    alert("Abra uma conversa antes de enviar mensagens.");
    return;
  }

  const msg = inputMsg.value.trim();
  if (msg === "") return;

  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");

  const dadosMsg = {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
    lidoPor: [auth.currentUser.email],
  };

  if (respostaMsg) {
    dadosMsg.respondeA = {
      id: respostaMsg.id,
      texto: respostaMsg.texto,
      usuario: respostaMsg.usuario,
    };
  }

  await addDoc(mensagensRef, dadosMsg);

  inputMsg.value = "";
  respostaMsg = null;
  atualizarRespostaUI();

  await atualizarDigitando(false);
});

inputMsg.addEventListener("input", () => {
  if (!conversaIdAtual) return;
  atualizarDigitando(true);
  resetDigitandoTimeout();
});

inputMsg.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    btnSend.click();
  }
});

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function tentarLogin() {
  document.getElementById("loginBtn").click();
}

emailInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tentarLogin();
  }
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tentarLogin();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    await carregarApelidosCache();

    const apelido = apelidosCache[user.email];

    if (!apelido) {
      mostrarNicknameModal();
    } else {
      userEmailSpan.textContent = apelido;
    }

    btnSend.disabled = true;
    inputMsg.disabled = true;
    carregarContatos();
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
    conversaIdAtual = null;
    if (unsubscribeMensagens) unsubscribeMensagens();
    if (unsubscribeTyping) unsubscribeTyping();
    chatBox.innerHTML = "";
    friendEmailInput.value = "";
    typingIndicator.textContent = "";
    contatosSalvosSelect.style.display = "none";
    contatosSalvosSelect.innerHTML = "";
    esconderNicknameModal();
  }
});

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) {
    unsubscribeMensagens();
  }
  if (unsubscribeTyping) {
    unsubscribeTyping();
  }

  chatBox.innerHTML = "";
  typingIndicator.textContent = "";

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    chatBox.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      if (!data.lidoPor || !data.lidoPor.includes(auth.currentUser.email)) {
        updateDoc(docSnap.ref, {
          lidoPor: [...(data.lidoPor || []), auth.currentUser.email],
        }).catch(console.error);
      }

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(
        data.usuario === auth.currentUser.email ? "own" : "friend"
      );

      // Monta texto com resposta, se tiver
      let textoMsg = "";

      if (data.respondeA) {
        const apelidoResposta = await getApelido(data.respondeA.usuario);
        textoMsg += `${apelidoResposta}: ${data.respondeA.texto}\n→ `;
      }

      textoMsg += data.texto;

      msgEl.textContent = textoMsg;

      msgEl.style.cursor = "pointer";
      msgEl.title = "Clique para responder";
      msgEl.addEventListener("click", () => {
        respostaMsg = { id, texto: data.texto, usuario: data.usuario };
        atualizarRespostaUI();
        inputMsg.focus();
      });

      if (data.usuario === auth.currentUser.email) {
        const outros = data.lidoPor.filter(
          (email) => email !== auth.currentUser.email
        );
        const statusEl = document.createElement("div");
        statusEl.classList.add("status");
        statusEl.textContent = outros.length > 0 ? "✓✓ Visto" : "✓ Enviado";
        msgEl.appendChild(statusEl);
      }

      chatBox.appendChild(msgEl);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  });

  const conversaDoc = doc(db, "conversas", conversaId);

  unsubscribeTyping = onSnapshot(conversaDoc, async (docSnap) => {
    if (!docSnap.exists()) {
      setDoc(
        conversaDoc,
        {
          [`digitando_${auth.currentUser.email}`]: false,
        },
        { merge: true }
      );
      typingIndicator.textContent = "";
      return;
    }

    const data = docSnap.data();
    const usuarioAtual = auth.currentUser.email;

    const usuarios = conversaId.split("_");
    const amigoEmail = usuarios.find((email) => email !== usuarioAtual);

    if (data[`digitando_${amigoEmail}`]) {
      const apelido = await getApelido(amigoEmail);
      typingIndicator.textContent = `${apelido} está digitando...`;
    } else {
      typingIndicator.textContent = "";
    }
  });
}

function atualizarRespostaUI() {
  const respostaBox = document.getElementById("respostaBox");
  if (!respostaMsg) {
    respostaBox.style.display = "none";
    respostaBox.textContent = "";
    return;
  }
  getApelido(respostaMsg.usuario).then((apelido) => {
    respostaBox.style.display = "block";
    respostaBox.innerHTML = `<strong>${apelido}:</strong> ${respostaMsg.texto} <button id="cancelReplyBtn" title="Cancelar resposta">×</button>`;

    const btnCancel = document.getElementById("cancelReplyBtn");
    btnCancel.onclick = () => {
      respostaMsg = null;
      atualizarRespostaUI();
    };
  });
}
