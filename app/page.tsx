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
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; // 自分のUID

export default function Home() {
  // --- States ---
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [dmPosts, setDmPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  const [page, setPage] = useState("home"); 
  const [activeRoom, setActiveRoom] = useState<any>(null); 
  const [activeFriend, setActiveFriend] = useState<any>(null); 
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showTos, setShowTos] = useState(false); // 利用規約モーダル

  // --- Firebase Listeners ---
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
        onSnapshot(query(collection(db, "friends"), where("users", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });

    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    if (user?.uid === ADMIN_UID) {
      onSnapshot(query(collection(db, "reports"), orderBy("createdAt", "desc")), (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return () => unsubAuth();
  }, [user]);

  // Chat/DM Monitoring
  useEffect(() => {
    if (page === "chat" && activeRoom) {
      const q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    if (page === "dm" && activeFriend) {
      const q = query(collection(db, "dms"), where("chatters", "array-contains", user.uid), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (s) => {
        const allDms = s.docs.map(d => ({ id: d.id, ...d.data() }));
        setDmPosts(allDms.filter((d: any) => d.chatters.includes(activeFriend.uid)));
      });
    }
  }, [page, activeRoom, activeFriend, user]);

  // --- Functions ---
  const sendPost = async (isDm = false) => {
    if (!text.trim() && !postImage) return;
    try {
      const targetCol = isDm ? "dms" : "posts";
      const postData: any = {
        text, image: postImage,
        senderUid: user.uid, name: myData.name, icon: myData.icon, displayId: myData.displayId,
        likes: [], createdAt: serverTimestamp(),
      };
      if (isDm) { postData.chatters = [user.uid, activeFriend.uid]; } 
      else { 
        postData.room = activeRoom.id;
        postData.isSystem = user.uid === ADMIN_UID;
        if (replyTo) postData.replyTo = { id: replyTo.id, name: replyTo.name, text: replyTo.text };
      }
      await addDoc(collection(db, targetCol), postData);
      setText(""); setPostImage(null); setReplyTo(null);
    } catch (e) { alert("送信に失敗しました"); }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    await addDoc(collection(db, "rooms"), { name: newRoomName, createdBy: user.uid, createdAt: serverTimestamp() });
    setNewRoomName("");
    alert("部屋を作成しました！部屋一覧から入室してください。");
  };

  const handleAuth = async (type: "signup" | "login") => {
    if (type === "signup" && !showTos) { alert("利用規約を確認してください"); setShowTos(true); return; }
    const email = `${encodeURIComponent(username)}@chatia.app`;
    try {
      if (type === "signup") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false });
      } else { await signInWithEmailAndPassword(auth, email, password); }
      setPage("home");
    } catch (e) { alert("認証エラー"); }
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none", transition: "0.2s" };

  // --- Render Helpers ---
  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "100px", fontFamily: "sans-serif" }}>
        <h1>Chatia</h1>
        <button onClick={() => setPage("auth")} style={{ padding: "10px 20px", borderRadius: "10px", ...btnStyle, background: "#000", color: "#fff" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", color: "#333", fontFamily: "sans-serif" }}>
      <style>{`.btn-active:active { transform: scale(0.95); opacity: 0.8; }`}</style>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 10px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <b style={{ fontSize: "20px" }} onClick={() => setPage("home")}>Chatia</b>
          <button onClick={() => setPage("notify")} className="btn-active" style={{ ...btnStyle, background: "none", fontSize: "20px" }}>🔔{notifications.length > 0 && "🔴"}</button>
        </header>

        <div style={{ flex: 1, padding: "15px", paddingBottom: "150px" }}>
          
          {/* ホーム画面 */}
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "linear-gradient(135deg, #000, #444)", color: "#fff", padding: "30px", borderRadius: "20px" }}>
                <h2 style={{ margin: 0 }}>Home</h2>
                <p style={{ opacity: 0.7 }}>@{myData?.displayId}</p>
                <div style={{ marginTop: "20px" }}>
                  <input placeholder="新しい部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", marginBottom: "10px" }} />
                  <button onClick={createRoom} className="btn-active" style={{ ...btnStyle, background: "#fff", color: "#000", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold", width: "100%" }}>＋ 部屋を作る</button>
                </div>
              </div>
              <button onClick={() => setShowTos(true)} style={{ ...btnStyle, background: "#f0f0f0", padding: "15px", borderRadius: "15px" }}>利用規約を確認する</button>
              {user?.uid === ADMIN_UID && <button onClick={() => setPage("admin")} style={{ ...btnStyle, background: "#ff4d4f", color: "#fff", padding: "15px", borderRadius: "10px" }}>🛡 管理者：通報を確認</button>}
            </div>
          )}

          {/* 部屋一覧画面 */}
          {page === "rooms" && (
            <div>
              <h3>部屋一覧</h3>
              <p style={{ fontSize: "12px", color: "#999" }}>入室するとチャットができます</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "15px" }}>
                {rooms.map(r => (
                  <div key={r.id} onClick={() => { setActiveRoom(r); setPage("chat"); }} className="btn-active" style={{ background: "#f9f9f9", padding: "20px", borderRadius: "15px", textAlign: "center", cursor: "pointer", border: "1px solid #eee" }}>
                    <b># {r.name}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* チャット画面 */}
          {page === "chat" && activeRoom && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                <button onClick={() => setPage("rooms")} style={{ ...btnStyle, background: "#eee", padding: "5px 10px", borderRadius: "5px" }}>← 戻る</button>
                <b># {activeRoom.name}</b>
              </div>
              {posts.map(p => (
                <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #f2f2f2", background: p.isSystem ? "#fff9e6" : "none" }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <img src={p.icon} style={{ width: "45px", height: "45px", borderRadius: "12px", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: "14px" }}>{p.name}</b> {p.isSystem && <span style={{fontSize: "10px", background: "#000", color: "#fff", padding: "2px 4px", borderRadius: "4px", marginLeft: "5px"}}>運営</span>}
                      <p style={{ margin: "5px 0", fontSize: "15px", whiteSpace: "pre-wrap" }}>{p.text}</p>
                      {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", marginTop: "5px" }} />}
                      <div style={{ display: "flex", gap: "15px", marginTop: "5px" }}>
                        <button onClick={() => setReplyTo(p)} style={{ ...btnStyle, background: "none", color: "#999", fontSize: "12px" }}>💬返信</button>
                        <button onClick={() => updateDoc(doc(db, "posts", p.id), { likes: (p.likes || []).includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) })} style={{ ...btnStyle, background: "none", fontSize: "12px" }}>❤ {(p.likes || []).length}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* フレンド・DM・プロフ（略：以前のロジックを継承） */}
          {page === "friends" && (
             <div>
               <h3>フレンド</h3>
               {friends.map(f => {
                 const friendUid = f.users.find((id: string) => id !== user.uid);
                 const friendData = allUsers.find(u => u.uid === friendUid);
                 return (
                   <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #eee" }}>
                     <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                       <img src={friendData?.icon || DEFAULT_ICON} style={{ width: "40px", height: "40px", borderRadius: "10px" }} />
                       <b>{friendData?.name}</b>
                     </div>
                     <button onClick={() => { setActiveFriend(friendData); setPage("dm"); }} style={{ ...btnStyle, background: "#000", color: "#fff", padding: "5px 15px", borderRadius: "10px" }}>DM</button>
                   </div>
                 );
               })}
             </div>
          )}

          {page === "dm" && activeFriend && (
            <div>
              <button onClick={() => setPage("friends")} style={{ ...btnStyle, background: "#f0f0f0", padding: "5px 10px", borderRadius: "5px", marginBottom: "15px" }}>← 戻る</button>
              <h3>{activeFriend.name} とのDM</h3>
              {dmPosts.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: p.senderUid === user.uid ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                  <div style={{ maxWidth: "75%", background: p.senderUid === user.uid ? "#000" : "#f0f0f0", color: p.senderUid === user.uid ? "#fff" : "#000", padding: "10px", borderRadius: "15px" }}>
                    <p style={{ margin: 0 }}>{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              <img src={myData?.icon} style={{ width: "100px", height: "100px", borderRadius: "30px", objectFit: "cover" }} />
              <div style={{ margin: "20px 0" }}>
                <label style={{ background: "#f0f0f0", padding: "10px 20px", borderRadius: "10px", cursor: "pointer" }}>
                  アイコン変更
                  <input type="file" style={{ display: "none" }} accept="image/*" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string });
                    r.readAsDataURL(file);
                  }} />
                </label>
              </div>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: "10px", width: "80%", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "10px", marginTop: "10px", width: "85%" }}>保存</button>
              <button onClick={() => signOut(auth)} style={{ ...btnStyle, display: "block", margin: "30px auto", color: "red", background: "none" }}>ログアウト</button>
            </div>
          )}

          {/* 利用規約モーダル */}
          {showTos && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
              <div style={{ background: "#fff", padding: "25px", borderRadius: "20px", maxWidth: "400px" }}>
                <h3>利用規約</h3>
                <div style={{ fontSize: "13px", color: "#666", maxHeight: "300px", overflowY: "auto" }}>
                  <p>1. 他人を不快にする投稿を禁止します。</p>
                  <p>2. 個人情報の投稿を禁止します。</p>
                  <p>3. 運営は不適切と判断した投稿やユーザーを予告なく削除・BANできるものとします。</p>
                  <p>4. 画像投稿は自己責任で行ってください。</p>
                </div>
                <button onClick={() => setShowTos(false)} style={{ ...btnStyle, background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px", marginTop: "20px" }}>同意して閉じる</button>
              </div>
            </div>
          )}

          {/* 認証画面 */}
          {page === "auth" && (
            <div style={{ textAlign: "center", paddingTop: "50px" }}>
              <h2>Chatia</h2>
              <input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "85%", padding: "15px", marginBottom: "10px", borderRadius: "12px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "85%", padding: "15px", marginBottom: "10px", borderRadius: "12px", border: "1px solid #ddd" }} />
              <button onClick={() => handleAuth("signup")} style={{ ...btnStyle, width: "85%", background: "#000", color: "#fff", padding: "15px", borderRadius: "12px", marginBottom: "10px" }}>新規登録</button>
              <button onClick={() => handleAuth("login")} style={{ ...btnStyle, width: "85%", border: "1px solid #ddd", padding: "15px", borderRadius: "12px" }}>ログイン</button>
              <p style={{ fontSize: "11px", color: "#999", marginTop: "10px" }}>新規登録で利用規約に同意したことになります</p>
            </div>
          )}
        </div>

        {/* 投稿バー (チャット中またはDM中のみ表示) */}
        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "75px", width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", padding: "15px", zIndex: 100 }}>
            {replyTo && <div style={{ fontSize: "11px", color: "#999", marginBottom: "5px" }}>返信先: {replyTo.name} <button onClick={() => setReplyTo(null)} style={{ border: "none" }}>×</button></div>}
            {postImage && <div style={{ position: "relative", marginBottom: "10px" }}><img src={postImage} style={{ height: "60px", borderRadius: "10px" }} /><button onClick={() => setPostImage(null)} style={{ position: "absolute", top: 0, left: 50, background: "red", color: "#fff", border: "none", borderRadius: "50%" }}>×</button></div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: "16px" }} rows={1} />
              <button onClick={() => sendPost(page === "dm")} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "5px 20px", borderRadius: "20px", fontWeight: "bold" }}>送信</button>
            </div>
            <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
              <label style={{ cursor: "pointer", fontSize: "20px" }}>🖼<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(f);
              }} /></label>
              <button onClick={() => setText(t => t + "😊")} style={{ background: "none", border: "none", fontSize: "20px" }}>😊</button>
              <button onClick={() => setText(t => t + "🔥")} style={{ background: "none", border: "none", fontSize: "20px" }}>🔥</button>
              <button onClick={() => setText(t => t + "✨")} style={{ background: "none", border: "none", fontSize: "20px" }}>✨</button>
            </div>
          </div>
        )}

        {/* ナビゲーションバー */}
        <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", borderTop: "1px solid #eee", background: "#fff", zIndex: 100 }}>
          <button onClick={() => setPage("home")} style={{ ...btnStyle, flex: 1, padding: "18px", color: page === "home" ? "#000" : "#ccc", fontSize: "20px" }}>🏠</button>
          <button onClick={() => setPage("rooms")} style={{ ...btnStyle, flex: 1, padding: "18px", color: page === "rooms" || page === "chat" ? "#000" : "#ccc", fontSize: "20px" }}>🏘</button>
          <button onClick={() => setPage("friends")} style={{ ...btnStyle, flex: 1, padding: "18px", color: page === "friends" || page === "dm" ? "#000" : "#ccc", fontSize: "20px" }}>👥</button>
          <button onClick={() => setPage("profile")} style={{ ...btnStyle, flex: 1, padding: "18px", color: page === "profile" ? "#000" : "#ccc", fontSize: "20px" }}>👤</button>
        </nav>

        {/* ユーザー詳細モーダル */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "20px", textAlign: "center", width: "300px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "80px", height: "80px", borderRadius: "20px" }} />
              <h3>{selectedUser.name}</h3>
              <p style={{ color: "#999" }}>@{selectedUser.displayId}</p>
              {selectedUser.uid !== user.uid && (
                <button onClick={async () => {
                  await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: myData.name, toUid: selectedUser.uid, type: "friend_req", createdAt: serverTimestamp() });
                  alert("申請を送りました"); setSelectedUser(null);
                }} style={{ ...btnStyle, background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px" }}>フレンド申請</button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}