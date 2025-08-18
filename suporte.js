import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, deleteDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase config
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
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const friendEmailInput = document.getElementById("friendEmail");
const friendApelidoInput = document.getElementById("friendApelido");
const startChatBtn = document.getElementById("startChatBtn");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
const typingIndicator = document.getElementById("typingIndicator");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;
let apelidosCache = {};
let respostaMsg = null;

// Funções
function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function atualizarDigitando(status) {
  if (!conversaIdAtual || !auth.currentUser) return;
  const conversaRef = doc(db, "conversas", conversaIdAtual);
  await setDoc(conversaRef, { [`digitando_${auth.currentUser.email}`]: status }, { merge: true });
}

function mostrarNicknameModal() {
  nicknameModal.style.display = "flex";
  nicknameInput.value = apelidosCache[auth.currentUser.email] || "";
  nicknameInput.focus();
}

function esconderNicknameModal() {
  nicknameModal.style.display = "none";
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

async function getApelido(email) {
  if (!email) return "Anônimo";
  if (apelidosCache[email]) return apelidosCache[email];
  try {
    const userDocRef = doc(db, "users", email);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists() && userDocSnap.data().nickname) {
      apelidosCache[email] = userDocSnap.data().nickname;
      localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
      return apelidosCache[email];
    }
  } catch (error) {
    console.error("Erro ao buscar apelido:", error);
  }
  return email;
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
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(c => {
      const option = document.createElement("option");
      option.value = c.email;
      option.textContent = c.apelido;
      contatosSalvosSelect.appendChild(option);
    });
  } else {
    contatosSalvosSelect.style.display = "none";
  }
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
    document.getElementById("cancelReplyBtn").onclick = () => {
      respostaMsg = null;
      atualizarRespostaUI();
    };
  });
}

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) { unsubscribeMensagens(); unsubscribeMensagens = null; }
  if (unsubscribeTyping) { unsubscribeTyping(); unsubscribeTyping = null; }

  conversaIdAtual = conversaId;
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
    let apelidoUsuario = apelidosCache[auth.currentUser.email] || auth.currentUser.email;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      if (!data.lidoPor || !data.lidoPor.includes(auth.currentUser.email)) {
        updateDoc(docSnap.ref, { lidoPor: [...(data.lidoPor || []), auth.currentUser.email] }).catch(console.error);
      }

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      let remetenteApelido = data.usuario;
      const contatoMsg = contatos.find(c => c.email === data.usuario);
      if (contatoMsg) remetenteApelido = contatoMsg.apelido;
      else if (data.usuario === auth.currentUser.email) remetenteApelido = apelidoUsuario;

      let textoMsg = "";
      if (data.respondeA) {
        const apelidoResposta = await getApelido(data.respondeA.usuario);
        textoMsg += `${apelidoResposta}: ${data.respondeA.texto}\n→ `;
      }
      textoMsg += data.texto;

      const textContentEl = document.createElement("span");
      textContentEl.textContent = textoMsg;
      msgEl.appendChild(textContentEl);

      // Menu de opções (três pontinhos)
      if (data.usuario === auth.currentUser.email) {
        const menuBtn = document.createElement("span");
        menuBtn.textContent = "⋮";
        menuBtn.classList.add("menu-btn");
        msgEl.appendChild(menuBtn);

        const menu = document.createElement("div");
        menu.classList.add("msg-menu");
        menu.innerHTML = `
          <button class="editar">Editar</button>
          <button class="copiar">Copiar</button>
          <button class="apagar">Apagar</button>
        `;
        msgEl.appendChild(menu);

        menuBtn.onclick = () => {
          menu.classList.toggle("show");
        };

        // Editar
        menu.querySelector(".editar").onclick = async () => {
          const novoTexto = prompt("Edite sua mensagem:", data.texto);
          if (novoTexto && novoTexto.trim() !== "") {
            await updateDoc(docSnap.ref, { texto: novoTexto });
          }
          menu.classList.remove("show");
        };

        // Copiar
        menu.querySelector(".copiar").onclick = () => {
          navigator.clipboard.writeText(data.texto);
          alert("Mensagem copiada!");
          menu.classList.remove("show");
        };

        // Apagar
        menu.querySelector(".apagar").onclick = async () => {
          if (confirm("Deseja apagar esta mensagem?")) {
            await deleteDoc(docSnap.ref);
          }
          menu.classList.remove("show");
        };
      }

      if (data.usuario === auth.currentUser.email) {
        const outros = data.lidoPor.filter(email => email !== auth.currentUser.email);
        const statusEl = document.createElement("div");
        statusEl.classList.add("status");
        statusEl.textContent = outros.length > 0 ? "✓✓ Visto" : "✓ Enviado";
        msgEl.appendChild(statusEl);
      }

      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // Listener de digitando
  const conversaDoc = doc(db, "conversas", conversaId);
  unsubscribeTyping = onSnapshot(conversaDoc, async (docSnap) => {
    if (!docSnap.exists()) {
      await setDoc(conversaDoc, { [`digitando_${auth.currentUser.email}`]: false }, { merge: true });
      typingIndicator.textContent = "";
      return;
    }
    const data = docSnap.data();
    const usuarioAtual = auth.currentUser.email;
    const amigoEmail = conversaId.split("_").find(email => email !== usuarioAtual);
    const apelido = await getApelido(amigoEmail);
    typingIndicator.textContent = data[`digitando_${amigoEmail}`] ? `${apelido} está digitando...` : "";
  });
}

// Eventos
saveNicknameBtn.addEventListener("click", async () => {
  const apelido = nicknameInput.value.trim();
  if (apelido.length < 2) return alert("Digite um apelido com pelo menos 2 caracteres.");
  await salvarApelido(apelido);
  userApelidoDisplay.textContent = apelido;
  esconderNicknameModal();
});

startChatBtn.addEventListener("click", async () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const usuario = auth.currentUser.email.toLowerCase();
  if (amigo === "" || amigo === usuario) return alert("Digite um email válido e diferente do seu.");
  let contato = JSON.parse(localStorage.getItem("contatosChat"))?.find(c => c.email === amigo);
  if (!contato) {
    const apelidoNovo = prompt("Digite um apelido para esse contato:");
    if (!apelidoNovo) return alert("Você precisa informar um apelido para iniciar a conversa.");
    salvarContato(amigo, apelidoNovo);
  }
  abrirConversa(gerarIdConversa(usuario, amigo));
});

btnSend.addEventListener("click", async () => {
  const msg = inputMsg.value.trim();
  if (!msg || !conversaIdAtual) return;
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

// Enter para login
["email", "password", "apelido"].forEach(id => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("loginBtn").click();
  });
});

// Autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    await carregarApelidosCache();
    const apelido = apelidosCache[user.email] || user.email;
    userApelidoDisplay.textContent = apelido;

    btnSend.disabled = false;
    inputMsg.disabled = false;
    carregarContatos();

    esconderNicknameModal();
  } else {
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});
