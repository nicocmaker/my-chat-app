"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; // 管理者のUID

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
  const [activeDM, setActiveDM] = useState<any>(null); // DM相手
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState(""); // 画像送信URL
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists() && snap.data().isBanned) { 
            alert("凍結されています。"); signOut(auth); return; 
          }
          setMyData(snap.data());
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(5)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubAuth();
  }, []);

  // チャット & DM取得
  useEffect(() => {
    let q;
    if (page === "chat" && activeRoom) {
      q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
    } else if (page === "dm" && activeDM) {
      const dmId = [user.uid, activeDM.uid].sort().join("_");
      q = query(collection(db, "posts"), where("room", "==", dmId), orderBy("createdAt", "desc"), limit(50));
    } else return;

    return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [page, activeRoom, activeDM, user]);

  const sendPost = async () => {
    if (!text.trim() && !imageUrl.trim()) return;
    const roomId = page === "dm" ? [user.uid, activeDM.uid].sort().join("_") : activeRoom.id;
    await addDoc(collection(db, "posts"), {
      text, image: imageUrl, room: roomId, senderUid: user.uid, name: myData.name, icon: myData.icon, createdAt: serverTimestamp(), isSystem: user.uid === ADMIN_UID,
    });
    setText(""); setImageUrl("");
  };

  const deletePost = async (id: string) => {
    if (confirm("このメッセージを削除しますか？")) await deleteDoc(doc(db, "posts", id));
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none" };

  if (!user && page !== "auth") {
    return <div style={{ textAlign: "center", paddingTop: "100px" }}><h1>Chatia</h1><button onClick={() => setPage("auth")} style={{ padding: "10px 20px", borderRadius: "20px", ...btnStyle, background: "#000", color: "#fff" }}>はじめる</button></div>;
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
          <b style={{ fontSize: "18px" }}>Chatia</b>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "140px" }}>
          {page === "home" && (
            <div>
              <div style={{ padding: "20px", background: "#000", color: "#fff", borderRadius: "15px", marginBottom: "25px" }}><h2>ようこそ、{myData?.name}さん</h2><p>ID: @{myData?.displayId}</p></div>
              <section style={{marginBottom: "20px"}}><h4>🔔 運営通知</h4>{notifications.map(n => <div key={n.id} style={{ padding: "10px", background: "#fff5f5", borderRadius: "8px", marginBottom: "5px" }}>{n.text}</div>)}</section>
              <section style={{marginBottom: "20px"}}><h4>📜 利用規約</h4><div style={{ fontSize: "13px", background: "#f9f9f9", padding: "10px", borderRadius: "8px" }}>1.誹謗中傷禁止 2.荒らし禁止 3.健全な利用</div></section>
              <section><h4>📩 お問い合わせ</h4><button style={{ ...btnStyle, width: "100%", padding: "10px", background: "#eee", borderRadius: "8px" }}>運営へ連絡</button></section>
            </div>
          )}

          {page === "rooms" && (
            <div><h3>ルーム一覧</h3>{rooms.map(r => <div key={r.id} onClick={() => { setActiveRoom(r); setPage("chat"); }} style={{ padding: "15px", border: "1px solid #eee", borderRadius: "12px", marginBottom: "10px", cursor: "pointer" }}># {r.name}</div>)}</div>
          )}

          {(page === "chat" || page === "dm") && (
            <div>
              <button onClick={() => setPage(page === "dm" ? "friends" : "rooms")} style={btnStyle}>← 戻る</button>
              <h4>{page === "dm" ? `${activeDM?.name} とのDM` : `# ${activeRoom?.name}`}</h4>
              <div style={{ display: "flex", flexDirection: "column-reverse" }}>
                {posts.map(p => (
                  <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #f2f2f2", position: "relative" }}>
                    <div style={{display:"flex", gap:"10px"}}>
                      <img src={p.icon || DEFAULT_ICON} style={{ width: "35px", height: "35px", borderRadius: "50%" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                      <div>
                        <b style={{fontSize:"12px"}}>{p.name}</b>
                        <p style={{margin:"2px 0"}}>{p.text}</p>
                        {p.image && <img src={p.image} style={{maxWidth: "200px", borderRadius: "8px", marginTop: "5px"}} />}
                      </div>
                      {(user.uid === ADMIN_UID || p.senderUid === user.uid) && <button onClick={() => deletePost(p.id)} style={{...btnStyle, background: "none", color: "#ccc", marginLeft: "auto"}}>🗑️</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "friends" && (
            <div>
              <h3>フレンド</h3>
              {friends.map(f => {
                const fData = allUsers.find(u => u.uid === f.uids.find((id:any) => id !== user.uid));
                return fData && (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #eee" }}>
                    <b>{fData.name}</b>
                    <button onClick={() => { setActiveDM(fData); setPage("dm"); }} style={{...btnStyle, background: "#000", color: "#fff", padding: "5px 10px", borderRadius: "5px"}}>DMを送る</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- 下部ナビ --- */}
        <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", height: "70px" }}>
          {["home", "rooms", "friends", "profile"].map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ ...btnStyle, flex: 1, background: "none", color: page === p ? "#000" : "#bbb" }}>
              {p === "home" && "ホーム"} {p === "rooms" && "チャット"} {p === "friends" && "フレンド"} {p === "profile" && "自分"}
            </button>
          ))}
        </nav>

        {/* --- 投稿バー --- */}
        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "70px", width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", padding: "10px" }}>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="画像URL (任意)" style={{ width: "100%", fontSize: "11px", marginBottom: "5px", border: "none", color: "#888" }} />
            <div style={{display: "flex", gap: "10px"}}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="メッセージ..." style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #eee" }} />
              <button onClick={sendPost} style={{ ...btnStyle, background: "#000", color: "#fff", padding: "0 20px", borderRadius: "20px" }}>送信</button>
            </div>
          </div>
        )}

        {/* --- ユーザー詳細モーダル (BAN機能) --- */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "20px", borderRadius: "15px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "60px", height: "60px", borderRadius: "50%" }} />
              <h3>{selectedUser.name}</h3>
              {user.uid === ADMIN_UID && selectedUser.uid !== ADMIN_UID && (
                <button onClick={() => { if(confirm("BANしますか？")) updateDoc(doc(db, "users", selectedUser.uid), {isBanned: true}); }} style={{...btnStyle, background: "red", color: "#fff", padding: "10px", borderRadius: "8px"}}>🚫 ユーザーをBANする</button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}