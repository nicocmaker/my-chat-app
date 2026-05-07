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
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(5)), (s) => 
          setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid)), (s) => 
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

  // スタイル・アニメーション設定
  const btnAni = "active:scale-95 transition-transform duration-100";
  const sectionBox = { border: "2px solid #000", padding: "15px", borderRadius: "12px", marginBottom: "20px" };
  const btnBase = { cursor: "pointer", border: "none", outline: "none" };

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "100px", fontFamily: "sans-serif" }}>
        <h1>Chatia</h1>
        <button onClick={() => setPage("auth")} className={btnAni} style={{ padding: "12px 30px", borderRadius: "25px", ...btnBase, background: "#000", color: "#fff", fontWeight: "bold" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #eee", background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "space-between" }}>
          <b style={{ fontSize: "18px" }}>Chatia</b>
          {user && <span style={{fontSize:"12px", color:"#888"}}>@{myData?.displayId}</span>}
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "160px" }}>
          {page === "home" && (
            <div>
              <div style={{ padding: "25px", background: "#000", color: "#fff", borderRadius: "15px", marginBottom: "25px" }}>
                <h2 style={{margin: 0}}>ようこそ、{myData?.name}さん</h2>
              </div>

              <section style={sectionBox}>
                <h4 style={{margin: "0 0 10px 0"}}>🔔 運営通知</h4>
                {notifications.length === 0 ? <p style={{fontSize:"13px", color:"#999"}}>通知はありません</p> : 
                  notifications.map(n => <div key={n.id} style={{fontSize:"14px", padding:"5px 0"}}>{n.text}</div>)
                }
              </section>

              <section style={sectionBox}>
                <h4 style={{margin: "0 0 10px 0"}}>📜 利用規約</h4>
                <p style={{fontSize:"13px", color:"#666"}}>安心・安全な利用のために規約を確認してください。</p>
                <button onClick={() => setShowTos(true)} className={btnAni} style={{ ...btnBase, background: "#eee", width: "100%", padding: "10px", borderRadius: "8px", fontWeight: "bold" }}>規約を表示</button>
              </section>

              <section>
                <h4 style={{marginBottom: "10px"}}>📩 お問い合わせ</h4>
                <button className={btnAni} style={{ ...btnBase, background: "#f0f2f5", width: "100%", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}>運営へ連絡する</button>
              </section>
            </div>
          )}

          {page === "rooms" && (
            <div>
              <div style={{background: "#f9f9f9", padding: "15px", borderRadius: "12px", marginBottom: "20px"}}>
                <h4 style={{margin: "0 0 10px 0"}}>新しい部屋を作る</h4>
                <input placeholder="部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: "1px solid #ddd"}} />
                <input placeholder="パスワード (任意)" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} style={{width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: "1px solid #ddd"}} />
                <button onClick={async () => {
                  if(newRoomName) { await addDoc(collection(db, "rooms"), { name: newRoomName, password: newRoomPass, createdAt: serverTimestamp() }); setNewRoomName(""); setNewRoomPass(""); }
                }} className={btnAni} style={{...btnBase, background: "#000", color: "#fff", width: "100%", padding: "10px", borderRadius: "8px", fontWeight: "bold"}}>作成する</button>
              </div>
              <h3 style={{marginBottom: "15px"}}>ルーム一覧</h3>
              {rooms.map(r => (
                <div key={r.id} onClick={() => {
                  if(r.password) { const p = prompt("パスワードを入力してください"); if(p !== r.password) return alert("パスワードが違います"); }
                  setActiveRoom(r); setPage("chat");
                }} className={btnAni} style={{ padding: "15px", border: "1px solid #eee", borderRadius: "12px", marginBottom: "10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{fontSize: "16px"}}># {r.name}</b> {r.password && <span>🔒</span>}
                </div>
              ))}
            </div>
          )}

          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              <img src={myData?.icon} style={{ width: "80px", height: "80px", borderRadius: "50%", marginBottom: "20px", border: "2px solid #eee", objectFit: "cover" }} />
              <div style={{ marginBottom: "15px", textAlign: "left" }}>
                <label style={{fontSize: "12px", color: "#888"}}>名前</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }} />
              </div>
              <div style={{ marginBottom: "20px", textAlign: "left" }}>
                <label style={{fontSize: "12px", color: "#888"}}>アイコンURL</label>
                <input value={editIcon} onChange={e => setEditIcon(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }} />
              </div>
              <button onClick={async () => {
                await updateDoc(doc(db, "users", user.uid), { name: editName, icon: editIcon });
                alert("プロフィールを更新しました");
              }} className={btnAni} style={{ ...btnBase, background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}>変更を保存</button>
              
              <button onClick={() => signOut(auth)} className={btnAni} style={{ ...btnBase, color: "red", background: "none", marginTop: "40px", fontSize: "14px", fontWeight: "bold" }}>ログアウト</button>
            </div>
          )}

          {(page === "chat" || page === "dm") && (
            <div>
              <button onClick={() => setPage(page === "dm" ? "friends" : "rooms")} style={{...btnBase, marginBottom: "15px"}} className={btnAni}>← 戻る</button>
              <div style={{ display: "flex", flexDirection: "column-reverse" }}>
                {posts.map(p => (
                  <div key={p.id} style={{ display: "flex", gap: "10px", padding: "12px 0", borderBottom: "1px solid #f9f9f9" }}>
                    <img src={p.icon || DEFAULT_ICON} style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{flex: 1}}>
                      <div style={{display: "flex", justifyContent: "space-between"}}>
                        <b style={{fontSize: "12px"}}>{p.name}</b>
                        {(user.uid === ADMIN_UID || p.senderUid === user.uid) && (
                          <button onClick={async () => { if(confirm("削除しますか？")) await deleteDoc(doc(db, "posts", p.id)); }} style={{...btnBase, background: "none", color: "#ccc", fontSize: "12px"}}>🗑️</button>
                        )}
                      </div>
                      <p style={{margin: "4px 0", fontSize: "15px"}}>{p.text}</p>
                      {p.image && <img src={p.image} style={{maxWidth: "100%", borderRadius: "8px", marginTop: "5px"}} alt="posted" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "friends" && (
            <div>
              <h3 style={{marginBottom: "20px"}}>フレンド</h3>
              {friends.length === 0 ? <p style={{textAlign:"center", color:"#999", marginTop:"20px"}}>まだフレンドがいません</p> : 
                friends.map(f => {
                  const fData = allUsers.find(u => u.uid === f.uids.find((id:any) => id !== user.uid));
                  return fData && (
                    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderBottom: "1px solid #eee" }}>
                      <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                        <img src={fData.icon} style={{width:"40px", height:"40px", borderRadius:"50%", objectFit: "cover"}} />
                        <b>{fData.name}</b>
                      </div>
                      <button onClick={() => { setActiveDM(fData); setPage("dm"); }} className={btnAni} style={{...btnBase, background: "#000", color: "#fff", padding: "8px 15px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold"}}>DM</button>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>

        {/* --- 利用規約モーダル --- */}
        {showTos && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "15px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
              <h3 style={{marginTop: 0}}>利用規約</h3>
              <div style={{ fontSize: "13px", maxHeight: "250px", overflowY: "auto", color: "#555", lineHeight: "1.6" }}>
                1. 誹謗中傷の禁止：他者を不快にする投稿を禁じます。<br/>
                2. 個人情報の禁止：住所や電話番号の掲載を禁じます。<br/>
                3. 荒らしの禁止：連続投稿やスパムを禁じます。<br/>
                違反した場合は予告なくアカウントを停止します。
              </div>
              <button onClick={() => setShowTos(false)} className={btnAni} style={{ ...btnBase, background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "8px", fontWeight: "bold" }}>閉じる</button>
            </div>
          </div>
        )}

        {/* --- 下部ナビ --- */}
        {user && (
          <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", height: "75px", paddingBottom: "10px" }}>
            {["home", "rooms", "friends", "profile"].map(p => (
              <button key={p} onClick={() => setPage(p)} className={btnAni} style={{ ...btnBase, flex: 1, background: "none", color: page === p ? "#000" : "#bbb" }}>
                <div style={{fontSize: "20px"}}>{p === "home" ? "🏠" : p === "rooms" ? "💬" : p === "friends" ? "👥" : "👤"}</div>
                <div style={{fontSize: "10px", fontWeight: "bold"}}>{p === "home" ? "ホーム" : p === "rooms" ? "チャット" : p === "friends" ? "フレンド" : "自分"}</div>
              </button>
            ))}
          </nav>
        )}

        {/* --- 投稿入力 --- */}
        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "75px", width: "100%", maxWidth: "500px", background: "#fff", padding: "12px", borderTop: "1px solid #eee", boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="画像URLを貼り付け (任意)" style={{ width: "100%", fontSize: "11px", border: "none", color: "#888", marginBottom: "8px", outline: "none" }} />
            <div style={{display: "flex", gap: "10px"}}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, padding: "10px 15px", borderRadius: "25px", border: "1px solid #eee", background: "#f9f9f9", outline: "none" }} />
              <button onClick={sendPost} className={btnAni} style={{ ...btnBase, background: "#000", color: "#fff", padding: "0 20px", borderRadius: "25px", fontWeight: "bold" }}>送信</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}