"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

const ROOMS = [
  { id: "general1", name: "雑談1" },
  { id: "general2", name: "雑談2" },
  { id: "general3", name: "雑談3" },
  { id: "game1", name: "ゲーム1" },
  { id: "game2", name: "ゲーム2" },
  { id: "game3", name: "ゲーム3" },
  { id: "art1", name: "お絵描き1" },
  { id: "art2", name: "お絵描き2" },
  { id: "art3", name: "お絵描き3" },
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [activeRoom, setActiveRoom] = useState("general1");
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [username, setUsername] = useState(""); // メールの代わりに名前を使用
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // 1. 認証とデータ監視
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) { 
            const data = snap.data();
            setMyData(data); 
            setEditName(data.name); 
          }
        });
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    return () => unsubAuth();
  }, []);

  // 2. 投稿のリアルタイム取得（ルーム切り替え対応）
  useEffect(() => {
    // 投稿が見えない場合、orderByを外すと表示されることがあります（インデックス未作成のため）
    const q = query(
      collection(db, "posts"), 
      where("room", "==", activeRoom),
      orderBy("createdAt", "desc"), 
      limit(50)
    );
    const unsub = onSnapshot(q, (s) => {
      setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Firestore Error:", err);
      // エラーが出る場合（インデックス作成前など）は並び替えなしで再試行
      const simpleQ = query(collection(db, "posts"), where("room", "==", activeRoom), limit(50));
      onSnapshot(simpleQ, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    });
    return () => unsub();
  }, [activeRoom]);

  // 内部的に名前をメール形式に変換
  const getFakeEmail = (name: string) => `${encodeURIComponent(name)}@chatia.app`;

  const handleAuth = async (type: "signup" | "login") => {
    if (!username || !password) return alert("名前とパスワードを入力してください");
    const email = getFakeEmail(username);
    try {
      if (type === "signup") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          name: username,
          displayId: Math.random().toString(36).substring(7),
          icon: DEFAULT_ICON
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setPage("home");
      setUsername(""); setPassword("");
    } catch (e: any) {
      alert("エラー: 名前が既に使われているか、パスワードが違います。");
    }
  };

  const sendPost = async () => {
    if (!text.trim() && !postImage) return;
    await addDoc(collection(db, "posts"), {
      text, image: postImage, room: activeRoom,
      senderUid: user?.uid || "guest", name: myData?.name || "ゲスト", 
      icon: myData?.icon || DEFAULT_ICON, displayId: myData?.displayId || "guest", 
      likes: [], createdAt: serverTimestamp()
    });
    setText(""); setPostImage(null);
  };

  const handleLike = async (p: any) => {
    const uid = user?.uid || "guest";
    const ref = doc(db, "posts", p.id);
    (p.likes || []).includes(uid) ? await updateDoc(ref, { likes: arrayRemove(uid) }) : await updateDoc(ref, { likes: arrayUnion(uid) });
  };

  const btnStyle: React.CSSProperties = {
    cursor: "pointer",
    transition: "transform 0.1s ease, opacity 0.1s",
    border: "none",
    outline: "none",
  };

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", color: "#1a1a1a" }}>
      <style>{`
        .btn-active:active { transform: scale(0.96); opacity: 0.8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 20px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 100 }}>
          <b style={{ fontSize: "22px", letterSpacing: "-0.5px", fontWeight: "900" }}>Chatia</b>
          <div>
            {!user && <button onClick={() => setPage("auth")} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "6px 15px", borderRadius: "20px", fontSize: "12px" }}>ログイン</button>}
          </div>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "100px" }}>
          
          {/* ホーム */}
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ textAlign: "center", padding: "50px 20px", background: "#000", borderRadius: "20px", color: "#fff" }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>Chatiaへようこそ</h2>
                <p style={{ fontSize: "14px", opacity: 0.8 }}>{user ? `${myData?.name}さん、こんにちは` : "ゲストさん、こんにちは"}</p>
              </div>
            </div>
          )}

          {/* チャット */}
          {page === "global" && (
            <>
              <div className="no-scrollbar" style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "20px" }}>
                {ROOMS.map(r => (
                  <button key={r.id} onClick={() => setActiveRoom(r.id)} className="btn-active" style={{ ...btnStyle, whiteSpace: "nowrap", padding: "10px 18px", borderRadius: "10px", fontSize: "13px", background: activeRoom === r.id ? "#000" : "#f5f5f5", color: activeRoom === r.id ? "#fff" : "#666" }}>{r.name}</button>
                ))}
              </div>
              <div style={{ border: "1px solid #eee", padding: "15px", borderRadius: "15px", marginBottom: "25px" }}>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="投稿内容を入力..." style={{ width: "100%", border: "none", outline: "none", fontSize: "16px", resize: "none" }} rows={2} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <label className="btn-active" style={{ ...btnStyle, fontSize: "13px", color: "#666" }}>画像を追加<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]); }} /></label>
                  <button onClick={sendPost} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "8px 25px", borderRadius: "20px", fontWeight: "bold" }}>投稿</button>
                </div>
              </div>
              {posts.map(p => (
                <div key={p.id} style={{ display: "flex", gap: "12px", padding: "15px 0", borderBottom: "1px solid #f9f9f9" }}>
                  <img src={p.icon || DEFAULT_ICON} className="btn-active" style={{ ...btnStyle, width: "45px", height: "45px", borderRadius: "12px", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid) || { name: p.name, icon: p.icon, displayId: p.displayId, uid: p.senderUid })} />
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: "14px" }}>{p.name} <span style={{ fontWeight: "normal", color: "#999" }}>@{p.displayId}</span></b>
                    <p style={{ margin: "5px 0", fontSize: "15px" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", marginTop: "8px" }} />}
                    <button onClick={() => handleLike(p)} style={{ ...btnStyle, background: "none", marginTop: "5px", fontSize: "12px" }}>
                      {(p.likes || []).includes(user?.uid) ? "❤️" : "🤍"} {(p.likes || []).length}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* プロフィール */}
          {page === "profile" && (
            <div style={{ paddingTop: "20px" }}>
              {!user ? <p style={{ textAlign: "center" }}>ログインが必要です</p> : (
                <>
                  {/* アイコンと名前の横並び */}
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "40px", padding: "0 10px" }}>
                    <img src={myData?.icon || DEFAULT_ICON} style={{ width: "80px", height: "80px", borderRadius: "20px", objectFit: "cover", background: "#f5f5f5" }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "900" }}>{myData?.name}</h3>
                      <p style={{ margin: "4px 0 0", color: "#999", fontSize: "14px" }}>@{myData?.displayId}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <label className="btn-active" style={{ ...btnStyle, flex: 1, background: "#f5f5f5", padding: "12px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold", textAlign: "center" }}>
                        アイコンを変更
                        <input type="file" style={{ display: "none" }} onChange={e => {
                          const r = new FileReader(); r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string }); r.readAsDataURL(e.target.files![0]);
                        }} />
                      </label>
                      <button onClick={() => updateDoc(doc(db, "users", user.uid), { icon: DEFAULT_ICON })} className="btn-active" style={{ ...btnStyle, background: "#fff", border: "1px solid #eee", color: "#ff4d4f", padding: "12px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold" }}>削除</button>
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      <p style={{ fontSize: "12px", color: "#999", marginBottom: "8px", marginLeft: "5px" }}>名前を変更</p>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "1px solid #f0f0f0", fontSize: "15px", background: "#fafafa" }} />
                    </div>
                    <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "15px", borderRadius: "12px", fontWeight: "bold", marginTop: "10px" }}>保存</button>
                    <button onClick={() => signOut(auth)} className="btn-active" style={{ ...btnStyle, color: "#999", marginTop: "30px", fontSize: "13px", background: "none" }}>ログアウト</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 認証 */}
          {page === "auth" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <h2 style={{ marginBottom: "30px", fontWeight: "900" }}>Chatia</h2>
              <input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "10px", borderRadius: "12px", border: "1px solid #ddd", fontSize: "16px" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "20px", borderRadius: "12px", border: "1px solid #ddd", fontSize: "16px" }} />
              <button onClick={() => handleAuth("signup")} className="btn-active" style={{ ...btnStyle, width: "100%", background: "#000", color: "#fff", padding: "15px", borderRadius: "12px", fontWeight: "bold" }}>新規登録</button>
              <button onClick={() => handleAuth("login")} className="btn-active" style={{ ...btnStyle, width: "100%", marginTop: "10px", padding: "15px", borderRadius: "12px", border: "1px solid #ddd" }}>ログイン</button>
            </div>
          )}
        </div>

        <nav style={{ display: "flex", borderTop: "1px solid #f0f0f0", background: "#fff", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", zIndex: 100 }}>
          <button onClick={() => setPage("home")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", background: "none", color: page === "home" ? "#000" : "#bbb", fontWeight: "bold", fontSize: "11px" }}>HOME</button>
          <button onClick={() => setPage("global")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", background: "none", color: page === "global" ? "#000" : "#bbb", fontWeight: "bold", fontSize: "11px" }}>CHAT</button>
          <button onClick={() => setPage("profile")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", background: "none", color: page === "profile" ? "#000" : "#bbb", fontWeight: "bold", fontSize: "11px" }}>PROFILE</button>
        </nav>

        {/* ユーザーポップアップ */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "25px", textAlign: "center", width: "320px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon || DEFAULT_ICON} style={{ width: "80px", height: "80px", borderRadius: "20px", objectFit: "cover" }} />
              <h3 style={{ margin: "15px 0 5px" }}>{selectedUser.name}</h3>
              <p style={{ color: "#999", fontSize: "13px", marginBottom: "25px" }}>@{selectedUser.displayId}</p>
              <button onClick={() => setSelectedUser(null)} style={{ color: "#999", background: "none", border: "none", fontSize: "12px" }}>閉じる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}