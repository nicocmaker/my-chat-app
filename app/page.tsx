"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc, arrayUnion, arrayRemove, or, and
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; // 自分のUIDをここに

export default function Home() {
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
  const [activeFriend, setActiveFriend] = useState<any>(null); // DM相手
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [newRoomName, setNewRoomName] = useState("");
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
        // 通知取得
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(20)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        // フレンド取得
        onSnapshot(query(collection(db, "friends"), where("users", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });

    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setRooms(list);
      if (!activeRoom && list.length > 0) setActiveRoom(list[0]);
    });

    if (user?.uid === ADMIN_UID) {
      onSnapshot(query(collection(db, "reports"), orderBy("createdAt", "desc")), (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return () => unsubAuth();
  }, [user]);

  // 通常投稿の監視
  useEffect(() => {
    if (!activeRoom || page !== "global") return;
    const q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeRoom, page]);

  // DMの監視
  useEffect(() => {
    if (!activeFriend || page !== "dm") return;
    const q = query(collection(db, "dms"), 
      where("chatters", "array-contains", user.uid),
      orderBy("createdAt", "desc"), limit(50)
    );
    return onSnapshot(q, (s) => {
      const allDms = s.docs.map(d => ({ id: d.id, ...d.data() }));
      // 相手とのDMだけフィルタ
      setDmPosts(allDms.filter((d: any) => d.chatters.includes(activeFriend.uid)));
    });
  }, [activeFriend, page, user]);

  const sendPost = async (isDm = false) => {
    if (!text.trim() && !postImage) return;
    const targetCol = isDm ? "dms" : "posts";
    const postData: any = {
      text, image: postImage,
      senderUid: user.uid, name: myData.name, icon: myData.icon, displayId: myData.displayId,
      likes: [], createdAt: serverTimestamp(),
    };

    if (isDm) {
      postData.chatters = [user.uid, activeFriend.uid];
    } else {
      postData.room = activeRoom.id;
      postData.isSystem = user.uid === ADMIN_UID;
      postData.replyTo = replyTo ? { id: replyTo.id, name: replyTo.name, text: replyTo.text } : null;
    }

    await addDoc(collection(db, targetCol), postData);
    
    if (!isDm) {
      allUsers.forEach(u => {
        if (text.includes(`@${u.name}`)) {
          addDoc(collection(db, "notifications"), { toUid: u.uid, fromUid: user.uid, fromName: myData.name, type: "mention", text: text.substring(0, 15), createdAt: serverTimestamp() });
        }
      });
    }
    setText(""); setPostImage(null); setReplyTo(null);
  };

  const handleAuth = async (type: "signup" | "login") => {
    const email = `${encodeURIComponent(username)}@chatia.app`;
    try {
      if (type === "signup") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const displayId = Math.random().toString(36).substring(7); // 個人ID生成
        await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId, icon: DEFAULT_ICON, isBanned: false });
      } else { await signInWithEmailAndPassword(auth, email, password); }
      setPage("home");
    } catch (e) { alert("認証エラー"); }
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none" };

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", color: "#333" }}>
      <style>{`.btn-active:active { transform: scale(0.95); opacity: 0.8; } .no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", sticky: "top", background: "#fff", zIndex: 10 }}>
          <b style={{ fontSize: "20px" }} onClick={() => setPage("home")}>Chatia</b>
          {user && (
            <button onClick={() => setPage("notify")} className="btn-active" style={{ ...btnStyle, background: "none", fontSize: "20px" }}>
              🔔{notifications.length > 0 && "🔴"}
            </button>
          )}
        </header>

        <div style={{ flex: 1, padding: "15px", paddingBottom: "130px" }}>
          
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ background: "#000", color: "#fff", padding: "30px", borderRadius: "20px", textAlign: "center" }}>
                <p>ようこそ、{myData?.name}さん</p>
                <p style={{ fontSize: "12px", opacity: 0.6 }}>ID: @{myData?.displayId}</p>
                <input placeholder="新しい部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ width: "80%", padding: "10px", borderRadius: "10px", border: "none", marginTop: "10px", color: "#000" }} />
                <button onClick={async () => { if(newRoomName) await addDoc(collection(db, "rooms"), { name: newRoomName, createdAt: serverTimestamp() }); setNewRoomName(""); }} style={{ ...btnStyle, background: "#fff", padding: "8px 20px", borderRadius: "20px", marginTop: "10px", fontWeight: "bold" }}>部屋を作る</button>
              </div>
              {user?.uid === ADMIN_UID && <button onClick={() => setPage("admin")} style={{ ...btnStyle, background: "#ff4d4f", color: "#fff", padding: "15px", borderRadius: "10px" }}>🛡 管理パネル</button>}
            </div>
          )}

          {page === "global" && (
            <>
              <div className="no-scrollbar" style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "10px" }}>
                {rooms.map(r => <button key={r.id} onClick={() => setActiveRoom(r)} style={{ ...btnStyle, padding: "8px 15px", borderRadius: "20px", background: activeRoom?.id === r.id ? "#000" : "#f0f0f0", color: activeRoom?.id === r.id ? "#fff" : "#666", whiteSpace: "nowrap" }}>{r.name}</button>)}
              </div>
              {posts.map(p => (
                <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #f9f9f9", background: p.isSystem ? "#fff9e6" : "none" }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <img src={p.icon} style={{ width: "45px", height: "45px", borderRadius: "12px", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: "14px" }}>{p.name}</b> <span style={{ fontSize: "11px", color: "#ccc" }}>@{p.displayId}</span>
                      <p style={{ margin: "5px 0", fontSize: "15px" }}>{p.text}</p>
                      {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px" }} />}
                      <div style={{ display: "flex", gap: "15px", marginTop: "5px" }}>
                        <button onClick={() => setReplyTo(p)} style={{ ...btnStyle, background: "none", color: "#999", fontSize: "12px" }}>💬返信</button>
                        <button onClick={() => updateDoc(doc(db, "posts", p.id), { likes: (p.likes || []).includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) })} style={{ ...btnStyle, background: "none", fontSize: "12px" }}>❤ {(p.likes || []).length}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {page === "friends" && (
            <div>
              <h3>フレンド</h3>
              {friends.length === 0 && <p style={{ color: "#999" }}>まだフレンドがいません。</p>}
              {friends.map(f => {
                const friendUid = f.users.find((id: string) => id !== user.uid);
                const friendData = allUsers.find(u => u.uid === friendUid);
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img src={friendData?.icon} style={{ width: "40px", height: "40px", borderRadius: "10px" }} />
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
              <h3 style={{ textAlign: "center" }}>{activeFriend.name} とのDM</h3>
              {dmPosts.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: p.senderUid === user.uid ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                  <div style={{ maxWidth: "70%", background: p.senderUid === user.uid ? "#000" : "#f0f0f0", color: p.senderUid === user.uid ? "#fff" : "#000", padding: "10px", borderRadius: "15px" }}>
                    <p style={{ margin: 0, fontSize: "14px" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", marginTop: "5px" }} />}
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
                  アイコンを変える
                  <input type="file" style={{ display: "none" }} onChange={e => {
                    const r = new FileReader();
                    r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string });
                    r.readAsDataURL(e.target.files![0]);
                  }} />
                </label>
              </div>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: "10px", width: "80%", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "10px", marginTop: "10px", width: "85%" }}>名前を保存</button>
              <button onClick={() => signOut(auth)} style={{ ...btnStyle, display: "block", margin: "30px auto", color: "red", background: "none" }}>ログアウト</button>
            </div>
          )}

          {page === "notify" && (
            <div>
              <h3>通知</h3>
              {notifications.map(n => (
                <div key={n.id} style={{ padding: "15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>{n.fromName}</b>さんが{n.type === "mention" ? "メンションしました" : n.type === "friend_req" ? "フレンド申請しました" : "反応しました"}
                    <p style={{ fontSize: "12px", color: "#666" }}>{n.text}</p>
                  </div>
                  {n.type === "friend_req" && (
                    <button onClick={async () => {
                      await addDoc(collection(db, "friends"), { users: [user.uid, n.fromUid] });
                      await deleteDoc(doc(db, "notifications", n.id));
                      alert("フレンドになりました！");
                    }} style={{ ...btnStyle, background: "#28a745", color: "#fff", padding: "5px 10px", borderRadius: "5px" }}>承認</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {page === "auth" && (
            <div style={{ textAlign: "center", paddingTop: "50px" }}>
              <h2>Chatia</h2>
              <input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "80%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "80%", padding: "12px", marginBottom: "20px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={() => handleAuth("signup")} style={{ ...btnStyle, width: "85%", background: "#000", color: "#fff", padding: "12px", borderRadius: "10px", marginBottom: "10px" }}>新規登録</button>
              <button onClick={() => handleAuth("login")} style={{ ...btnStyle, width: "85%", border: "1px solid #ddd", padding: "12px", borderRadius: "10px" }}>ログイン</button>
            </div>
          )}
        </div>

        {/* 投稿バー */}
        {(page === "global" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "65px", width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", padding: "10px", zIndex: 100 }}>
            {replyTo && <div style={{ fontSize: "11px", color: "#999", marginBottom: "5px" }}>返信先: {replyTo.name} <button onClick={() => setReplyTo(null)} style={{ border: "none" }}>×</button></div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="入力してください..." style={{ flex: 1, border: "none", outline: "none", resize: "none" }} />
              <button onClick={() => sendPost(page === "dm")} style={{ ...btnStyle, background: "#000", color: "#fff", padding: "5px 20px", borderRadius: "20px", fontWeight: "bold" }}>送信</button>
            </div>
            <div style={{ display: "flex", gap: "15px", marginTop: "5px" }}>
              <label style={{ cursor: "pointer", fontSize: "18px" }}>🖼<input type="file" style={{ display: "none" }} onChange={e => {
                const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]);
              }} /></label>
              <button onClick={() => setText(t => t + "😊")} style={{ background: "none", border: "none", fontSize: "18px" }}>😊</button>
            </div>
          </div>
        )}

        {/* 下部ナビ */}
        <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", borderTop: "1px solid #eee", background: "#fff" }}>
          <button onClick={() => setPage("home")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "home" ? "#000" : "#ccc" }}>🏠</button>
          <button onClick={() => setPage("global")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "global" ? "#000" : "#ccc" }}>💬</button>
          <button onClick={() => setPage("friends")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "friends" || page === "dm" ? "#000" : "#ccc" }}>👥</button>
          <button onClick={() => setPage("profile")} style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "profile" ? "#000" : "#ccc" }}>👤</button>
        </nav>

        {/* ユーザー詳細モーダル（フレンド申請） */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "20px", textAlign: "center", width: "300px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "80px", height: "80px", borderRadius: "20px" }} />
              <h3>{selectedUser.name}</h3>
              <p style={{ color: "#999" }}>@{selectedUser.displayId}</p>
              {user && selectedUser.uid !== user.uid && (
                <button onClick={async () => {
                  await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: myData.name, toUid: selectedUser.uid, type: "friend_req", createdAt: serverTimestamp() });
                  alert("申請しました"); setSelectedUser(null);
                }} style={{ ...btnStyle, background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px", marginTop: "10px" }}>フレンド申請を送る</button>
              )}
              <button onClick={() => setSelectedUser(null)} style={{ background: "none", color: "#999", marginTop: "15px", border: "none" }}>閉じる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}