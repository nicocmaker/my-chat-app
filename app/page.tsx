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
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; // あなたのUID

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPass, setNewRoomPass] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.isBanned) { 
              alert("あなたのアカウントは規約違反により凍結されました。");
              signOut(auth); 
              return; 
            }
            setMyData(data);
            setEditName(data.name);
          }
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(10)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, "friends"), where("users", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (page === "chat" && activeRoom) {
      const q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [page, activeRoom]);

  const sendPost = async () => {
    if (!text.trim() && !postImage) return;
    const postData = {
      text, image: postImage, room: activeRoom.id, senderUid: user.uid, name: myData.name, icon: myData.icon, displayId: myData.displayId, createdAt: serverTimestamp(), isSystem: user.uid === ADMIN_UID,
    };
    await addDoc(collection(db, "posts"), postData);
    setText(""); setPostImage(null);
  };

  const deletePost = async (id: string) => {
    if (confirm("このメッセージを削除しますか？")) {
      await deleteDoc(doc(db, "posts", id));
    }
  };

  const banUser = async (targetUid: string) => {
    if (confirm("このユーザーを永久にBANしますか？")) {
      await updateDoc(doc(db, "users", targetUid), { isBanned: true });
      alert("ユーザーを凍結しました。");
      setSelectedUser(null);
    }
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none", transition: "0.1s" };

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "100px", fontFamily: "sans-serif" }}>
        <h1>Chatia</h1>
        <button onClick={() => setPage("auth")} style={{ padding: "10px 20px", borderRadius: "10px", ...btnStyle, background: "#000", color: "#fff" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh" }}>
      <style>{`.btn-ani:active { transform: scale(0.94); opacity: 0.8; } .admin-tag { background: #ff4d4f; color: #fff; font-size: 10px; padding: 2px 5px; borderRadius: 4px; margin-left: 5px; }`}</style>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <b style={{ fontSize: "20px" }} onClick={() => setPage("home")}>Chatia</b>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "150px" }}>
          
          {page === "home" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ padding: "40px 20px", background: "#000", color: "#fff", borderRadius: "20px" }}>
                <h2>こんにちは、{myData?.name}さん</h2>
                <p style={{ opacity: 0.6 }}>ID: @{myData?.displayId}</p>
                {user?.uid === ADMIN_UID && <p style={{ color: "#ff4d4f", fontSize: "12px" }}>🛡 管理者権限が有効です</p>}
              </div>
            </div>
          )}

          {page === "rooms" && (
            <div>
              <h3>部屋を作成</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "30px" }}>
                <input placeholder="部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} />
                <input placeholder="パスワード (任意)" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} />
                <button onClick={async () => { if(newRoomName){ await addDoc(collection(db, "rooms"), { name: newRoomName, password: newRoomPass, createdAt: serverTimestamp() }); setNewRoomName(""); setNewRoomPass(""); } }} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "12px", borderRadius: "10px" }}>作成</button>
              </div>
              <h3>部屋一覧</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {rooms.map(r => (
                  <div key={r.id} onClick={() => {
                    if(r.password) { const p = prompt("パスワード"); if(p !== r.password) return alert("不一致"); }
                    setActiveRoom(r); setPage("chat");
                  }} className="btn-ani" style={{ background: "#f8f9fa", padding: "20px", borderRadius: "15px", border: "1px solid #eee", textAlign: "center", cursor: "pointer" }}>
                    <b>{r.password ? "🔒" : "#"} {r.name}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "chat" && activeRoom && (
            <div>
              <button onClick={() => setPage("rooms")} style={{ ...btnStyle, background: "#eee", padding: "5px 10px", borderRadius: "8px", marginBottom: "15px" }}>← 戻る</button>
              {posts.map(p => (
                <div key={p.id} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: "1px solid #f2f2f2", position: "relative" }}>
                  <img src={p.icon} style={{ width: "45px", height: "45px", borderRadius: "12px", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: "14px" }}>{p.name}</b>
                    {p.isSystem && <span className="admin-tag">運営</span>}
                    <p style={{ margin: "4px 0" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px" }} />}
                  </div>
                  {user?.uid === ADMIN_UID && (
                    <button onClick={() => deletePost(p.id)} style={{ ...btnStyle, background: "none", color: "#ccc", fontSize: "12px" }}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {page === "tos" && (
            <div>
              <h3>📜 利用規約</h3>
              <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "15px", fontSize: "14px", color: "#444" }}>
                <p>1. 誹謗中傷・荒らし行為の禁止</p>
                <p>2. 不適切な画像投稿の禁止</p>
                <p>3. 運営によるBAN権限への同意</p>
              </div>
            </div>
          )}

          {page === "profile" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "20px", background: "#f8f9fa", padding: "20px", borderRadius: "20px" }}>
                <img src={myData?.icon} style={{ width: "80px", height: "80px", borderRadius: "50%", border: "2px solid #000" }} />
                <div>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: "18px", fontWeight: "bold", border: "none", borderBottom: "1px solid #ddd", background: "none" }} />
                  <p style={{ color: "#999", margin: 0 }}>@{myData?.displayId}</p>
                </div>
              </div>
              <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} className="btn-ani" style={{ ...btnStyle, width: "100%", background: "#000", color: "#fff", padding: "15px", borderRadius: "15px", marginTop: "20px" }}>保存</button>
              <button onClick={() => signOut(auth)} style={{ ...btnStyle, color: "red", width: "100%", marginTop: "20px", background: "none" }}>ログアウト</button>
            </div>
          )}

          {page === "auth" && (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <h2>Chatia</h2>
              <input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "80%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "80%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={async () => {
                const email = `${username}@chatia.app`;
                try {
                  const res = await createUserWithEmailAndPassword(auth, email, password);
                  await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false });
                  setPage("home");
                } catch { alert("エラー"); }
              }} className="btn-ani" style={{ ...btnStyle, width: "85%", background: "#000", color: "#fff", padding: "15px", borderRadius: "12px" }}>登録</button>
            </div>
          )}
        </div>

        {/* ユーザー詳細モーダル（ここにBANボタン） */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "20px", textAlign: "center", width: "250px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "80px", height: "80px", borderRadius: "50%" }} />
              <h3>{selectedUser.name}</h3>
              {user?.uid === ADMIN_UID && selectedUser.uid !== ADMIN_UID && (
                <button onClick={() => banUser(selectedUser.uid)} style={{ ...btnStyle, background: "red", color: "#fff", padding: "10px", borderRadius: "10px", width: "100%", marginTop: "10px" }}>🚫 このユーザーをBAN</button>
              )}
            </div>
          </div>
        )}

        {/* ナビ */}
        <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", borderTop: "1px solid #eee", background: "#fff", height: "80px" }}>
          <button onClick={() => setPage("home")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "home" ? "#000" : "#ccc", fontSize: "22px" }}>🏠</button>
          <button onClick={() => setPage("rooms")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "rooms" || page === "chat" ? "#000" : "#ccc", fontSize: "22px" }}>🏘</button>
          <button onClick={() => setPage("tos")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "tos" ? "#000" : "#ccc", fontSize: "22px" }}>📄</button>
          <button onClick={() => setPage("profile")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "profile" ? "#000" : "#ccc", fontSize: "22px" }}>👤</button>
        </nav>

        {/* 投稿バー（チャット中のみ） */}
        {page === "chat" && (
          <div style={{ position: "fixed", bottom: "80px", width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", padding: "15px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="メッセージ..." style={{ flex: 1, border: "none", outline: "none", resize: "none" }} rows={1} />
              <button onClick={sendPost} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "25px" }}>送信</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}