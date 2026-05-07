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
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; 

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [dmPosts, setDmPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [activeRoom, setActiveRoom] = useState<any>(null); 
  const [activeFriend, setActiveFriend] = useState<any>(null); 
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showTos, setShowTos] = useState(false);

  // --- データ監視 ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.isBanned) { alert("凍結中"); signOut(auth); return; }
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

  // チャット・DM監視
  useEffect(() => {
    if (page === "chat" && activeRoom) {
      const q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    if (page === "dm" && activeFriend) {
      const q = query(collection(db, "dms"), where("chatters", "array-contains", user.uid), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (s) => setDmPosts(s.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d.chatters.includes(activeFriend.uid))));
    }
  }, [page, activeRoom, activeFriend, user]);

  const sendPost = async (isDm = false) => {
    if (!text.trim() && !postImage) return;
    const targetCol = isDm ? "dms" : "posts";
    const postData: any = {
      text, image: postImage, senderUid: user.uid, name: myData.name, icon: myData.icon, displayId: myData.displayId, createdAt: serverTimestamp(),
    };
    if (isDm) postData.chatters = [user.uid, activeFriend.uid];
    else { postData.room = activeRoom.id; postData.isSystem = user.uid === ADMIN_UID; }
    await addDoc(collection(db, targetCol), postData);
    setText(""); setPostImage(null);
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none" };

  return (
    <div style={{ background: "#f5f7f9", minHeight: "100vh", color: "#333" }}>
      <style>{`.btn-ani:active { transform: scale(0.94); opacity: 0.8; } .btn-ani { transition: 0.1s; }`}</style>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <b style={{ fontSize: "20px" }} onClick={() => setPage("home")}>Chatia</b>
          <button onClick={() => setPage("notify")} className="btn-ani" style={{ ...btnStyle, background: "none", fontSize: "20px" }}>🔔{notifications.length > 0 && "🔴"}</button>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "150px" }}>
          
          {/* ホーム画面：規約・運営通知 */}
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ padding: "30px", background: "#000", color: "#fff", borderRadius: "20px", textAlign: "center" }}>
                <h2 style={{ margin: 0 }}>ようこそ、{myData?.name}さん</h2>
                <p style={{ opacity: 0.6, fontSize: "13px" }}>ID: @{myData?.displayId}</p>
              </div>

              <div style={{ background: "#fff9e6", padding: "15px", borderRadius: "15px", border: "1px solid #ffe58f" }}>
                <b style={{ color: "#856404" }}>📢 運営からのお知らせ</b>
                {rooms.length === 0 ? <p style={{ fontSize: "12px" }}>現在お知らせはありません</p> : <p style={{ fontSize: "12px" }}>新しい部屋が作成されました！</p>}
              </div>

              <div style={{ border: "1px solid #eee", padding: "15px", borderRadius: "15px" }}>
                <h3 style={{ fontSize: "16px", marginTop: 0 }}>📜 利用規約</h3>
                <div style={{ fontSize: "12px", color: "#666", lineHeight: "1.6", height: "150px", overflowY: "auto", background: "#f9f9f9", padding: "10px", borderRadius: "10px" }}>
                  <p><b>1. 禁止事項</b><br/>・誹謗中傷、荒らし行為<br/>・不適切な画像の投稿<br/>・個人情報の公開<br/>・スパム行為</p>
                  <p><b>2. 運営の権利</b><br/>運営は、規約に違反したユーザーを予告なくBAN（凍結）し、投稿を削除する権利を有します。</p>
                  <p><b>3. 免責事項</b><br/>本アプリの利用によるトラブルについて、運営は一切の責任を負いません。</p>
                </div>
                <p style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>※利用を開始した時点で上記に同意したものとみなします。</p>
              </div>
            </div>
          )}

          {/* 部屋一覧 */}
          {page === "rooms" && (
            <div>
              <h3>部屋一覧</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                <input placeholder="新しい部屋名" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
                <button onClick={async () => { if(newRoomName){ await addDoc(collection(db, "rooms"), { name: newRoomName, createdAt: serverTimestamp() }); setNewRoomName(""); } }} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 15px", borderRadius: "10px" }}>作成</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {rooms.map(r => (
                  <div key={r.id} onClick={() => { setActiveRoom(r); setPage("chat"); }} className="btn-ani" style={{ background: "#f8f9fa", padding: "20px", borderRadius: "15px", border: "1px solid #eee", textAlign: "center", cursor: "pointer" }}><b># {r.name}</b></div>
                ))}
              </div>
            </div>
          )}

          {/* チャット画面 */}
          {page === "chat" && activeRoom && (
            <div>
              <button onClick={() => setPage("rooms")} className="btn-ani" style={{ ...btnStyle, background: "#eee", padding: "5px 10px", borderRadius: "5px", marginBottom: "15px" }}>← 戻る</button>
              {posts.map(p => (
                <div key={p.id} style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: "1px solid #f9f9f9" }}>
                  <img src={p.icon} style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                  <div>
                    <b style={{ fontSize: "13px" }}>{p.name}</b> <span style={{ fontSize: "10px", color: "#ccc" }}>@{p.displayId}</span>
                    <p style={{ margin: "3px 0" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", marginTop: "5px" }} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* フレンド・DM・プロフ（これまでの機能を統合） */}
          {page === "friends" && (
            <div>
              <h3>フレンド一覧</h3>
              {friends.map(f => {
                const frData = allUsers.find(u => u.uid === f.users.find((id: string) => id !== user.uid));
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><img src={frData?.icon} style={{ width: "40px", height: "40px", borderRadius: "50%" }} /><b>{frData?.name}</b></div>
                    <button onClick={() => { setActiveFriend(frData); setPage("dm"); }} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "5px 15px", borderRadius: "10px" }}>DM</button>
                  </div>
                );
              })}
            </div>
          )}

          {page === "dm" && activeFriend && (
            <div>
              <button onClick={() => setPage("friends")} className="btn-ani" style={{ ...btnStyle, background: "#eee", padding: "5px 10px", borderRadius: "5px", marginBottom: "15px" }}>← 戻る</button>
              <h3>{activeFriend.name} とのDM</h3>
              {dmPosts.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: p.senderUid === user.uid ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                  <div style={{ maxWidth: "70%", background: p.senderUid === user.uid ? "#000" : "#f0f0f0", color: p.senderUid === user.uid ? "#fff" : "#000", padding: "10px", borderRadius: "15px" }}>{p.text}</div>
                </div>
              ))}
            </div>
          )}

          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "20px", background: "#f8f9fa", padding: "20px", borderRadius: "20px", marginBottom: "20px" }}>
                <img src={myData?.icon} style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "2px solid #000" }} />
                <div style={{ textAlign: "left" }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: "18px", fontWeight: "bold", border: "none", background: "none", borderBottom: "1px solid #ddd" }} />
                  <p style={{ color: "#999", margin: 0 }}>@{myData?.displayId}</p>
                </div>
              </div>
              <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} className="btn-ani" style={{ ...btnStyle, width: "100%", background: "#000", color: "#fff", padding: "15px", borderRadius: "15px", fontWeight: "bold" }}>名前を保存</button>
              <label style={{ display: "block", marginTop: "10px", padding: "10px", background: "#eee", borderRadius: "10px", cursor: "pointer" }}>アイコンを変更<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string }); r.readAsDataURL(e.target.files![0]); }} /></label>
              <button onClick={() => signOut(auth)} style={{ ...btnStyle, color: "red", marginTop: "30px", background: "none" }}>ログアウト</button>
            </div>
          )}

          {page === "notify" && (
            <div>
              <h3>通知</h3>
              {notifications.map(n => (
                <div key={n.id} style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                  <span><b>{n.fromName}</b>さんからフレンド申請</span>
                  <button onClick={async () => { await addDoc(collection(db, "friends"), { users: [user.uid, n.fromUid] }); await deleteDoc(doc(db, "notifications", n.id)); alert("フレンドになりました！"); }} style={{ ...btnStyle, background: "#28a745", color: "#fff", padding: "5px 10px", borderRadius: "5px" }}>承認</button>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* 投稿バー（チャット/DMのみ） */}
        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "70px", width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", padding: "10px", zIndex: 10 }}>
            {postImage && <div style={{ position: "relative" }}><img src={postImage} style={{ height: "50px", borderRadius: "5px" }} /><button onClick={() => setPostImage(null)} style={{ position: "absolute", top: 0, left: 40, background: "red", color: "#fff", border: "none", borderRadius: "50%" }}>×</button></div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="メッセージ..." style={{ flex: 1, border: "none", outline: "none", resize: "none" }} rows={1} />
              <button onClick={() => sendPost(page === "dm")} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold" }}>送信</button>
            </div>
            <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
              <label style={{ cursor: "pointer" }}>🖼<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]); }} /></label>
              <span onClick={() => setText(t => t + "😊")} style={{ cursor: "pointer" }}>😊</span>
            </div>
          </div>
        )}

        <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", borderTop: "1px solid #eee", background: "#fff", height: "70px" }}>
          <button onClick={() => setPage("home")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "home" ? "#000" : "#ccc", fontSize: "20px" }}>🏠</button>
          <button onClick={() => setPage("rooms")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "rooms" || page === "chat" ? "#000" : "#ccc", fontSize: "20px" }}>🏘</button>
          <button onClick={() => setPage("friends")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "friends" || page === "dm" ? "#000" : "#ccc", fontSize: "20px" }}>👥</button>
          <button onClick={() => setPage("profile")} className="btn-ani" style={{ ...btnStyle, flex: 1, color: page === "profile" ? "#000" : "#ccc", fontSize: "20px" }}>👤</button>
        </nav>

        {/* ユーザー詳細（フレンド申請用） */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "20px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "80px", height: "80px", borderRadius: "50%" }} />
              <h3>{selectedUser.name}</h3>
              {selectedUser.uid !== user.uid && (
                <button onClick={async () => { await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: myData.name, toUid: selectedUser.uid, type: "req", createdAt: serverTimestamp() }); alert("申請完了"); setSelectedUser(null); }} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "10px" }}>フレンド申請</button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}