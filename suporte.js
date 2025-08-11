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

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      alert(error.message);
    }
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth);
});

document.getElementById("btn-send").addEventListener("click", async () => {
  const msg = document.getElementById("input-msg").value;
  if (msg.trim() === "") return;
  await addDoc(collection(db, "mensagens"), {
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

    const q = query(collection(db, "mensagens"), orderBy("timestamp"));
    onSnapshot(q, (snapshot) => {
      chatBox.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const msgEl = document.createElement("p");
        msgEl.classList.add("msg");
        msgEl.style.background = data.usuario === user.email ? "#e1ffc7" : "#c7dfff";
        msgEl.style.padding = "5px";
        msgEl.style.borderRadius = "5px";
        msgEl.style.marginBottom = "5px";
        msgEl.textContent = `${data.usuario}: ${data.texto}`;
        chatBox.appendChild(msgEl);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
  }
});
