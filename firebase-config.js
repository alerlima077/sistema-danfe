// Configuração do Firebase - COLE SUAS CONFIGURAÇÕES AQUI
const firebaseConfig = {
  apiKey: "AIzaSyCl-zr_9Abho7uwLcTjNwTiGvPEnUQ5nKk",
  authDomain: "sistema-danfe.firebaseapp.com",
  projectId: "sistema-danfe",
  storageBucket: "sistema-danfe.firebasestorage.app",
  messagingSenderId: "1004092151534",
  appId: "1:1004092151534:web:29b8d1ccb6cb9ad863c5ff"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();