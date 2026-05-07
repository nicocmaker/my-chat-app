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
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; 

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [authMode, setAuthMode] = useState("signup");
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [activeDM, setActiveDM] = useState<any>(null);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPass, setNewRoomPass] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [showTos, setShowTos] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false); // 通知モーダルの管理
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.isBanned) { alert("凍結されています。"); signOut(auth); return; }
            setMyData(data);
            setEditName(data.name);
            setEditIcon(data.icon);
          }
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(10)), (s) => 
          setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid), where("status", "==", "accepted")), (s) => 
          setFriends(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubAuth();
  }, []);

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
      text, image: imageUrl, room: roomId, senderUid: user.uid, name: myData.name, icon: myData.icon, createdAt: serverTimestamp(),
    });
    setText(""); setImageUrl("");
  };

  const sendFriendRequest = async (targetUser: any) => {
    const friendId = [user.uid, targetUser.uid].sort().join("_");
    await setDoc(doc(db, "friends", friendId), {
      uids: [user.uid, targetUser.uid],
      status: "pending",
      from: user.uid,
      createdAt: serverTimestamp()
    });
    await addDoc(collection(db, "notifications"), {
      toUid: targetUser.uid,
      text: `${myData.name}さんからフレンド申請が届きました。`,
      type: "friend_request",
      fromUid: user.uid,
      createdAt: serverTimestamp()
    });
    alert("申請を送りました");
    setSelectedUser(null);
  };

  const btnAni = "active:scale-95 transition-transform duration-100 cursor-pointer border-none outline-none";
  const sectionBox = { border: "2px solid #000", padding: "15px", borderRadius: "15px", marginBottom: "20px" };

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "150px", fontFamily: "sans-serif" }}>
        <h1>Chatia</h1>
        <button onClick={() => setPage("auth")} className={btnAni} style={{ padding: "12px 30px", borderRadius: "25px", background: "#000", color: "#fff" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fcfcfc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "space-between" }}>
          <b style={{ fontSize: "20px" }}>Chatia</b>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "160px" }}>
          
          {page === "home" && (
            <div>
              <div style={{ padding: "25px", background: "#000", color: "#fff", borderRadius: "20px", marginBottom: "25px" }}>
                <h2 style={{margin: 0}}>ようこそ、{myData?.name}さん</h2>
              </div>

              <section style={sectionBox}>
                <h4 style={{margin: "0 0 10px 0"}}>🔔 運営通知</h4>
                <p style={{fontSize: "13px", color: "#666"}}>新機能や大切なお知らせはこちら。</p>
                <button onClick={() => setShowNotifs(true)} className={btnAni} style={{ background: "#f0f0f0", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>通知を確認する</button>
              </section>

              <section style={sectionBox}>
                <h4 style={{margin: "0 0 10px 0"}}>📜 利用規約</h4>
                <p style={{fontSize: "13px", color: "#666"}}>安心・安全な利用のために規約を確認してください。</p>
                <button onClick={() => setShowTos(true)} className={btnAni} style={{ background: "#f0f0f0", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>規約を表示</button>
              </section>

              <section>
                <h4>📩 お問い合わせ</h4>
                <button className={btnAni} style={{ background: "#fff", border: "1px solid #eee", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>運営へ連絡する</button>
              </section>
            </div>
          )}

          {/* ルーム・プロフ・チャット等の他ページ（前回と同じ） */}
          {page === "rooms" && (
            <div>
              <div style={{background: "#f9f9f9", padding: "15px", borderRadius: "15px", marginBottom: "20px"}}>
                <input placeholder="部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <input placeholder="パスワード (任意)" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} style={{width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <button onClick={async () => {
                  if(newRoomName) { await addDoc(collection(db, "rooms"), { name: newRoomName, password: newRoomPass, createdAt: serverTimestamp() }); setNewRoomName(""); setNewRoomPass(""); }
                }} className={btnAni} style={{background: "#000", color: "#fff", width: "100%", padding: "10px", borderRadius: "10px"}}>作成</button>
              </div>
              {rooms.map(r => (
                <div key={r.id} onClick={() => {
                  if(r.password) { const p = prompt("Password?"); if(p !== r.password) return; }
                  setActiveRoom(r); setPage("chat");
                }} className={btnAni} style={{ padding: "15px", border: "1px solid #eee", borderRadius: "15px", marginBottom: "10px", background:"#fff" }}>
                  <b># {r.name}</b> {r.password && "🔒"}
                </div>
              ))}
            </div>
          )}

          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              <img src={myData?.icon} style={{ width: "80px", height: "80px", borderRadius: "20px", marginBottom: "20px" }} />
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom:"10px" }} />
              <input value={editIcon} onChange={e => setEditIcon(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom:"20px" }} />
              <button onClick={async () => {
                await updateDoc(doc(db, "users", user.uid), { name: editName, icon: editIcon });
                alert("更新しました");
              }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px" }}>変更を保存</button>
              <button onClick={() => signOut(auth)} className={btnAni} style={{ color: "red", background: "none", marginTop: "40px" }}>ログアウト</button>
            </div>
          )}

          {(page === "chat" || page === "dm") && (
            <div>
              <button onClick={() => setPage(page === "dm" ? "friends" : "rooms")} className={btnAni} style={{marginBottom:"10px"}}>← 戻る</button>
              <div style={{ display: "flex", flexDirection: "column-reverse" }}>
                {posts.map(p => (
                  <div key={p.id} style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: "1px solid #f9f9f9" }}>
                    <img src={p.icon || DEFAULT_ICON} style={{ width: "40px", height: "40px", borderRadius: "10px" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{flex:1}}>
                      <div style={{display:"flex", justifyContent:"space-between"}}>
                        <b style={{fontSize:"12px"}}>{p.name}</b>
                        {(user.uid === ADMIN_UID || p.senderUid === user.uid) && <button onClick={() => deleteDoc(doc(db, "posts", p.id))} style={{background:"none", border:"none", color:"#ddd"}}>✕</button>}
                      </div>
                      <p style={{margin:"4px 0"}}>{p.text}</p>
                      {p.image && <img src={p.image} style={{maxWidth: "100%", borderRadius: "10px"}} />}
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
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #f5f5f5" }}>
                    <b>{fData.name}</b>
                    <button onClick={() => { setActiveDM(fData); setPage("dm"); }} className={btnAni} style={{background: "#000", color: "#fff", padding: "5px 15px", borderRadius: "8px"}}>DM</button>
                  </div>
                );
              })}
            </div>
          )}

          {page === "auth" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <h2>{authMode === "signup" ? "新規登録" : "ログイン"}</h2>
              <input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "20px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={async () => {
                const email = `${username}@chatia.app`;
                try {
                  if(authMode === "signup") {
                    const res = await createUserWithEmailAndPassword(auth, email, password);
                    await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false });
                  } else {
                    await signInWithEmailAndPassword(auth, email, password);
                  }
                  setPage("home");
                } catch(e) { alert("失敗しました"); }
              }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "10px", fontWeight: "bold" }}>確定</button>
              <p onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")} style={{marginTop:"20px", textDecoration:"underline"}}>{authMode === "signup" ? "ログインはこちら" : "新規登録はこちら"}</p>
            </div>
          )}
        </div>

        {/* --- 通知モーダル --- */}
        {showNotifs && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>🔔 通知一覧</h3>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {notifications.length === 0 ? <p style={{fontSize:"13px", color:"#999"}}>通知はありません</p> : 
                  notifications.map(n => (
                    <div key={n.id} style={{fontSize:"14px", padding:"10px 0", borderBottom:"1px solid #f0f0f0"}}>
                      {n.text}
                      {n.type === "friend_request" && (
                        <button onClick={async () => {
                          const friendId = [user.uid, n.fromUid].sort().join("_");
                          await updateDoc(doc(db, "friends", friendId), { status: "accepted" });
                          await deleteDoc(doc(db, "notifications", n.id));
                          alert("承認しました");
                        }} className={btnAni} style={{background:"#000", color:"#fff", fontSize:"11px", padding:"4px 10px", borderRadius:"5px", marginLeft:"10px"}}>承認</button>
                      )}
                    </div>
                  ))
                }
              </div>
              <button onClick={() => setShowNotifs(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "12px", fontWeight: "bold" }}>閉じる</button>
            </div>
          </div>
        )}

        {/* --- 利用規約モーダル --- */}
        {showTos && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>利用規約</h3>
              <div style={{ fontSize: "13px", maxHeight: "250px", overflowY: "auto", color: "#555" }}>
                1. 誹謗中傷の禁止<br/>2. 荒らし行為の禁止<br/>3. 個人情報の公開禁止<br/>違反した場合は予告なくアカウントを凍結します。
              </div>
              <button onClick={() => setShowTos(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "12px", fontWeight: "bold" }}>同意して閉じる</button>
            </div>
          </div>
        )}

        {/* ユーザー詳細モーダル、ナビ、投稿バー（前回と同じ） */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", width: "250px", padding: "20px", borderRadius: "20px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "60px", height: "60px", borderRadius: "15px", marginBottom: "10px" }} />
              <h4>{selectedUser.name}</h4>
              {selectedUser.uid !== user.uid && (
                <div style={{display:"flex", flexDirection:"column", gap:"8px", marginTop:"15px"}}>
                  <button onClick={() => sendFriendRequest(selectedUser)} className={btnAni} style={{background:"#000", color:"#fff", padding:"10px", borderRadius:"8px"}}>フレンド申請</button>
                  <button onClick={() => { setActiveDM(selectedUser); setPage("dm"); setSelectedUser(null); }} className={btnAni} style={{background:"#eee", padding:"10px", borderRadius:"8px"}}>DMを送る</button>
                </div>
              )}
            </div>
          </div>
        )}

        {user && (
          <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", height: "70px" }}>
            {["home", "rooms", "friends", "profile"].map(p => (
              <button key={p} onClick={() => setPage(p)} className={btnAni} style={{ flex: 1, background: "none", color: page === p ? "#000" : "#ccc" }}>
                <div style={{fontSize: "20px"}}>{p === "home" ? "🏠" : p === "rooms" ? "💬" : p === "friends" ? "👥" : "👤"}</div>
                <div style={{fontSize: "10px"}}>{p}</div>
              </button>
            ))}
          </nav>
        )}

        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "70px", width: "100%", maxWidth: "500px", background: "#fff", padding: "10px", borderTop: "1px solid #eee" }}>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL" style={{ width: "100%", fontSize: "10px", border: "none", color: "#888" }} />
            <div style={{display: "flex", gap: "10px"}}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Message" style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #eee" }} />
              <button onClick={sendPost} className={btnAni} style={{ background: "#000", color: "#fff", padding: "0 20px", borderRadius: "20px" }}>送信</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}