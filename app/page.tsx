"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc, arrayUnion, arrayRemove, getDocs
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; 

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]); // 通報リスト
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any>(null); 

  const [page, setPage] = useState("home"); 
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null); // リプライ先管理
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
            if (data.isBanned) { alert("BANされています"); signOut(auth); return; }
            setMyData(data);
            setEditName(data.name);
          }
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(20)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });

    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setRooms(list);
      if (!activeRoom && list.length > 0) setActiveRoom(list[0]);
    });

    // 管理者の場合のみ通報を監視
    if (user?.uid === ADMIN_UID) {
      onSnapshot(query(collection(db, "reports"), orderBy("createdAt", "desc")), (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }

    return () => unsubAuth();
  }, [user]);

  useEffect(() => {
    if (!activeRoom) return;
    const q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeRoom]);

  const handleAuth = async (type: "signup" | "login") => {
    const email = `${encodeURIComponent(username)}@chatia.app`;
    try {
      if (type === "signup") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false });
      } else { await signInWithEmailAndPassword(auth, email, password); }
      setPage("home");
    } catch (e) { alert("認証エラー"); }
  };

  const sendPost = async () => {
    if (!text.trim() && !postImage) return;
    const isSystem = user?.uid === ADMIN_UID;
    const postData: any = {
      text, image: postImage, room: activeRoom.id,
      senderUid: user?.uid || "guest", name: myData?.name || "ゲスト", icon: myData?.icon || DEFAULT_ICON, 
      displayId: myData?.displayId || "guest", likes: [], createdAt: serverTimestamp(),
      isSystem, replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, text: replyTo.text } : null
    };

    const docRef = await addDoc(collection(db, "posts"), postData);

    // メンション通知 (@名前 を探す)
    allUsers.forEach(u => {
      if (text.includes(`@${u.name}`)) {
        addDoc(collection(db, "notifications"), { toUid: u.uid, fromName: myData.name, type: "mention", text: text.substring(0, 20), createdAt: serverTimestamp() });
      }
    });

    // リプライ通知
    if (replyTo && replyTo.senderUid !== "guest") {
      await addDoc(collection(db, "notifications"), { toUid: replyTo.senderUid, fromName: myData.name, type: "reply", text: text.substring(0, 20), createdAt: serverTimestamp() });
    }

    setText(""); setPostImage(null); setReplyTo(null);
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none", transition: "0.1s" };

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", boxShadow: "0 0 10px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <b style={{ fontSize: "20px" }} onClick={() => setPage("home")}>Chatia</b>
          <div>
            <button onClick={() => setPage("notify")} style={{ ...btnStyle, background: "none", fontSize: "18px" }}>🔔{notifications.length > 0 && "🔴"}</button>
          </div>
        </header>

        <div style={{ flex: 1, padding: "15px", paddingBottom: "120px" }}>
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ background: "#000", color: "#fff", padding: "30px", borderRadius: "15px", textAlign: "center" }}>
                <h3>ルーム作成</h3>
                <input placeholder="部屋名" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ width: "90%", padding: "10px", borderRadius: "8px", border: "none", marginBottom: "10px" }} />
                <button onClick={() => { addDoc(collection(db, "rooms"), { name: newRoomName, createdBy: user.uid, createdAt: serverTimestamp() }); setNewRoomName(""); }} style={{ ...btnStyle, background: "#fff", padding: "10px 20px", borderRadius: "20px" }}>作成</button>
              </div>
              {user?.uid === ADMIN_UID && <button onClick={() => setPage("admin")} style={{ ...btnStyle, background: "#ff4d4f", color: "#fff", padding: "15px", borderRadius: "10px" }}>🛡 管理パネル（通報確認）</button>}
              <div style={{ border: "1px solid #eee", padding: "15px", borderRadius: "10px" }}><b>お知らせ</b><p style={{ fontSize: "12px" }}>メンション(@名前)ができるようになりました！</p></div>
            </div>
          )}

          {page === "global" && (
            <>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "10px" }} className="no-scrollbar">
                {rooms.map(r => <button key={r.id} onClick={() => setActiveRoom(r)} style={{ ...btnStyle, padding: "8px 15px", borderRadius: "20px", background: activeRoom?.id === r.id ? "#000" : "#f0f0f0", color: activeRoom?.id === r.id ? "#fff" : "#666", whiteSpace: "nowrap" }}>{r.name}</button>)}
              </div>

              {posts.map(p => (
                <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #f9f9f9", background: p.isSystem ? "#fff9e6" : "none" }}>
                  {p.replyTo && <div style={{ fontSize: "11px", color: "#999", marginLeft: "55px" }}>⤴ {p.replyTo.name}に返信: {p.replyTo.text.substring(0, 15)}...</div>}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <img src={p.icon} style={{ width: "45px", height: "45px", borderRadius: "10px" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <b style={{ fontSize: "13px" }}>{p.name}</b>
                        {p.isSystem && <span style={{ background: "#000", color: "#fff", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>運営</span>}
                        <span style={{ color: "#ccc", fontSize: "11px" }}>@{p.displayId}</span>
                      </div>
                      <p style={{ margin: "5px 0", fontSize: "14px", whiteSpace: "pre-wrap" }}>{p.text}</p>
                      {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "8px" }} />}
                      <div style={{ display: "flex", gap: "15px", marginTop: "5px" }}>
                        <button onClick={() => setReplyTo(p)} style={{ ...btnStyle, background: "none", fontSize: "12px", color: "#666" }}>💬 返信</button>
                        <button onClick={() => updateDoc(doc(db, "posts", p.id), { likes: (p.likes || []).includes(user?.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) })} style={{ ...btnStyle, background: "none", fontSize: "12px" }}>❤ {(p.likes || []).length}</button>
                        <button onClick={() => { confirm("通報しますか？") && addDoc(collection(db, "reports"), { ...p, reporter: user.uid, createdAt: serverTimestamp() }); }} style={{ ...btnStyle, background: "none", fontSize: "12px", color: "#ddd" }}>🚩</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {page === "admin" && (
            <div>
              <h3>🛡 通報管理リスト</h3>
              {reports.map(r => (
                <div key={r.id} style={{ border: "1px solid #ffebeb", padding: "10px", borderRadius: "10px", marginBottom: "10px", fontSize: "13px" }}>
                  <b>対象: {r.name}</b> (UID: {r.senderUid})<br/>
                  内容: {r.text}<br/>
                  <button onClick={() => updateDoc(doc(db, "users", r.senderUid), { isBanned: true })} style={{ background: "red", color: "#fff", border: "none", padding: "5px", borderRadius: "5px", marginRight: "10px" }}>このユーザーをBAN</button>
                  <button onClick={() => deleteDoc(doc(db, "reports", r.id))} style={{ background: "#eee", border: "none", padding: "5px", borderRadius: "5px" }}>却下</button>
                </div>
              ))}
            </div>
          )}

          {page === "notify" && (
            <div>
              <h3>通知</h3>
              {notifications.map(n => <div key={n.id} style={{ padding: "10px", borderBottom: "1px solid #eee", fontSize: "14px" }}><b>{n.fromName}</b>さんが{n.type === "mention" ? "あなたをメンションしました" : "返信しました"}: <span style={{ color: "#666" }}>{n.text}</span></div>)}
            </div>
          )}

          {page === "auth" && (
            <div style={{ textAlign: "center", paddingTop: "50px" }}>
              <h2>Chatia Login</h2>
              <input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "80%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "80%", padding: "12px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #ddd" }} />
              <button onClick={() => handleAuth("signup")} style={{ ...btnStyle, width: "85%", background: "#000", color: "#fff", padding: "12px", borderRadius: "8px", marginBottom: "10px" }}>新規登録</button>
              <button onClick={() => handleAuth("login")} style={{ ...btnStyle, width: "85%", border: "1px solid #ddd", padding: "12px", borderRadius: "8px" }}>ログイン</button>
            </div>
          )}
        </div>

        {/* 投稿エリア (固定) */}
        {page === "global" && (
          <div style={{ position: "fixed", bottom: "60px", width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", padding: "10px" }}>
            {replyTo && <div style={{ background: "#f0f0f0", padding: "5px 10px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}><span>返信先: {replyTo.name}</span><button onClick={() => setReplyTo(null)} style={{ border: "none", background: "none" }}>×</button></div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, border: "none", outline: "none", resize: "none" }} />
              <button onClick={sendPost} style={{ ...btnStyle, background: "#000", color: "#fff", padding: "5px 15px", borderRadius: "10px" }}>送信</button>
            </div>
            <div style={{ marginTop: "5px", display: "flex", gap: "10px" }}>
              <button onClick={() => setText(prev => prev + "😊")} style={{ background: "none", border: "none" }}>😊</button>
              <button onClick={() => setText(prev => prev + "🔥")} style={{ background: "none", border: "none" }}>🔥</button>
              <button onClick={() => setText(prev => prev + "✨")} style={{ background: "none", border: "none" }}>✨</button>
              <label style={{ cursor: "pointer", fontSize: "12px", color: "#666" }}>🖼<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]); }} /></label>
            </div>
          </div>
        )}

        <nav style={{ display: "flex", borderTop: "1px solid #eee", background: "#fff", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px" }}>
          <button onClick={() => setPage("home")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "home" ? "#000" : "#bbb" }}>ホーム</button>
          <button onClick={() => setPage("global")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "global" ? "#000" : "#bbb" }}>チャット</button>
          <button onClick={() => setPage("profile")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "profile" ? "#000" : "#bbb" }}>プロフ</button>
        </nav>

      </main>
    </div>
  );
}