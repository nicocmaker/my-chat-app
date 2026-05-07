"use client";

import { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc, Timestamp
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const ADMIN_UID = "KRs1odbdqscs6ZFJsq5YcHo9TtO2"; // あなたのUIDをここに入れてください
const ADMIN_EMAIL = "chamusandao@gmail.com"; // お問い合わせ送信先

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
  const [base64Image, setBase64Image] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [showTos, setShowTos] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // 通知の取得（フレンド申請やDM通知）
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(15)), (s) => 
          setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        // フレンド一覧の取得
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid), where("status", "==", "accepted")), (s) => 
          setFriends(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    
    // 24時間以内の部屋のみ表示
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    onSnapshot(query(collection(db, "rooms"), where("createdAt", ">=", oneDayAgo), orderBy("createdAt", "desc")), (s) => 
      setRooms(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    
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

  // 画像をBase64に変換
  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBase64Image(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const sendPost = async () => {
    if (!text.trim() && !base64Image) return;
    const isDM = page === "dm";
    const roomId = isDM ? [user.uid, activeDM.uid].sort().join("_") : activeRoom.id;
    
    await addDoc(collection(db, "posts"), {
      text, image: base64Image, room: roomId, senderUid: user.uid, name: myData.name, icon: myData.icon, createdAt: serverTimestamp(),
    });

    // DMの場合は相手に通知を送る
    if (isDM) {
      await addDoc(collection(db, "notifications"), {
        toUid: activeDM.uid,
        text: `${myData.name}さんからメッセージが届きました`,
        fromUid: user.uid,
        type: "dm",
        createdAt: serverTimestamp()
      });
    }

    setText(""); setBase64Image("");
  };

  const sendFriendRequest = async (targetUser: any) => {
    const friendId = [user.uid, targetUser.uid].sort().join("_");
    await setDoc(doc(db, "friends", friendId), { uids: [user.uid, targetUser.uid], status: "pending", from: user.uid, createdAt: serverTimestamp() });
    await addDoc(collection(db, "notifications"), {
      toUid: targetUser.uid,
      text: `${myData.name}さんからフレンド申請が届きました`,
      type: "friend_request",
      fromUid: user.uid,
      createdAt: serverTimestamp()
    });
    alert("申請を送りました");
    setSelectedUser(null);
  };

  const btnAni = "active:scale-95 transition-transform duration-100 cursor-pointer border-none outline-none";

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "150px" }}>
        <h1 style={{fontSize:"40px"}}>Chatia</h1>
        <button onClick={() => setPage("auth")} className={btnAni} style={{ padding: "15px 40px", borderRadius: "30px", background: "#000", color: "#fff", fontWeight: "bold" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fcfcfc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 15px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b style={{fontSize:"20px"}}>Chatia</b>
          {notifications.length > 0 && <span onClick={() => setShowNotifs(true)} style={{background:"red", color:"#fff", borderRadius:"50%", width:"20px", height:"20px", fontSize:"10px", display:"flex", justifyContent:"center", alignItems:"center", cursor:"pointer"}}>{notifications.length}</span>}
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "160px" }}>
          
          {page === "home" && (
            <div>
              <div style={{ padding: "25px", background: "#000", color: "#fff", borderRadius: "20px", marginBottom: "20px" }}>
                <h3 style={{margin: 0}}>こんにちは、{myData?.name}さん</h3>
              </div>
              <button onClick={() => setShowNotifs(true)} className={btnAni} style={{ background: "#f5f5f5", width: "100%", padding: "15px", borderRadius: "15px", marginBottom: "10px", textAlign: "left", fontWeight: "bold" }}>🔔 通知を見る</button>
              <button onClick={() => setShowTos(true)} className={btnAni} style={{ background: "#f5f5f5", width: "100%", padding: "15px", borderRadius: "15px", marginBottom: "10px", textAlign: "left", fontWeight: "bold" }}>📜 利用規約</button>
              <button onClick={() => window.location.href = `mailto:${ADMIN_EMAIL}?subject=お問い合わせ`} className={btnAni} style={{ background: "#f5f5f5", width: "100%", padding: "15px", borderRadius: "15px", textAlign: "left", fontWeight: "bold" }}>📩 お問い合わせ</button>
            </div>
          )}

          {page === "rooms" && (
            <div>
              <div style={{background: "#f9f9f9", padding: "15px", borderRadius: "15px", marginBottom: "20px"}}>
                <p style={{fontSize:"11px", color:"#888", marginBottom:"8px"}}>※作成した部屋は24時間で消滅します</p>
                <input placeholder="部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <button onClick={async () => {
                  if(newRoomName) { await addDoc(collection(db, "rooms"), { name: newRoomName, createdAt: serverTimestamp() }); setNewRoomName(""); }
                }} className={btnAni} style={{background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px"}}>部屋を作る</button>
              </div>
              {rooms.map(r => (
                <div key={r.id} onClick={() => { setActiveRoom(r); setPage("chat"); }} className={btnAni} style={{ padding: "18px", border: "1px solid #eee", borderRadius: "15px", marginBottom: "10px", background: "#fff" }}>
                  <b># {r.name}</b>
                </div>
              ))}
            </div>
          )}

          {page === "friends" && (
            <div>
              <h3 style={{marginBottom:"20px"}}>フレンド</h3>
              {friends.length === 0 ? <p style={{color:"#999", textAlign:"center"}}>まだフレンドがいません</p> : 
                friends.map(f => {
                  const fData = allUsers.find(u => u.uid === f.uids.find((id:any) => id !== user.uid));
                  return fData && (
                    <div key={f.id} style={{ display: "flex", alignItems:"center", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid #f5f5f5" }}>
                      <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                        <img src={fData.icon} style={{width:"40px", height:"40px", borderRadius:"10px"}} />
                        <b>{fData.name}</b>
                      </div>
                      <button onClick={() => { setActiveDM(fData); setPage("dm"); }} className={btnAni} style={{background: "#000", color: "#fff", padding: "8px 20px", borderRadius: "10px"}}>DM</button>
                    </div>
                  );
                })
              }
            </div>
          )}

          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              <img src={myData?.icon} style={{ width: "100px", height: "100px", borderRadius: "25px", marginBottom: "20px", border:"2px solid #000" }} />
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom:"10px" }} />
              <input placeholder="アイコンURL (任意)" value={editIcon} onChange={e => setEditIcon(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom:"20px" }} />
              <button onClick={async () => { await updateDoc(doc(db, "users", user.uid), { name: editName, icon: editIcon || DEFAULT_ICON }); alert("更新しました"); }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "12px" }}>変更を保存</button>
              <button onClick={() => signOut(auth)} className={btnAni} style={{ color: "red", background: "none", marginTop: "40px", fontWeight:"bold" }}>ログアウト</button>
            </div>
          )}

          {(page === "chat" || page === "dm") && (
            <div>
              <button onClick={() => setPage(page === "dm" ? "friends" : "rooms")} className={btnAni} style={{marginBottom:"15px", padding:"5px 15px", borderRadius:"10px", border:"1px solid #eee"}}>← 戻る</button>
              <div style={{ display: "flex", flexDirection: "column-reverse" }}>
                {posts.map(p => (
                  <div key={p.id} style={{ display: "flex", gap: "10px", padding: "12px 0", borderBottom: "1px solid #f9f9f9" }}>
                    <img src={p.icon || DEFAULT_ICON} style={{ width: "40px", height: "40px", borderRadius: "10px", cursor: "pointer" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{flex:1}}>
                      <b style={{fontSize:"12px"}}>{p.name}</b>
                      <p style={{margin:"4px 0", whiteSpace:"pre-wrap"}}>{p.text}</p>
                      {p.image && <img src={p.image} style={{maxWidth: "100%", borderRadius: "10px", marginTop: "5px"}} />}
                    </div>
                  </div>
                ))}
              </div>
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
                  } else { await signInWithEmailAndPassword(auth, email, password); }
                  setPage("home");
                } catch(e) { alert("失敗しました。名前が使われているか、パスワードが違います。"); }
              }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "10px", fontWeight: "bold" }}>確定</button>
              <p onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")} style={{marginTop:"20px", textDecoration:"underline"}}>{authMode === "signup" ? "既にアカウントをお持ちの方" : "新しく始める方"}</p>
            </div>
          )}
        </div>

        {/* --- 通知ポップアップ --- */}
        {showNotifs && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>🔔 通知</h3>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {notifications.length === 0 ? <p style={{color:"#999"}}>通知はありません</p> : 
                  notifications.map(n => (
                    <div key={n.id} style={{fontSize:"14px", padding:"12px 0", borderBottom:"1px solid #f0f0f0"}}>
                      {n.text}
                      {n.type === "friend_request" && (
                        <button onClick={async () => {
                          const friendId = [user.uid, n.fromUid].sort().join("_");
                          await updateDoc(doc(db, "friends", friendId), { status: "accepted" });
                          await deleteDoc(doc(db, "notifications", n.id));
                          alert("承認しました");
                        }} className={btnAni} style={{background:"#000", color:"#fff", fontSize:"11px", padding:"5px 12px", borderRadius:"5px", marginLeft:"10px"}}>承認</button>
                      )}
                    </div>
                  ))
                }
              </div>
              <button onClick={() => setShowNotifs(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "10px" }}>閉じる</button>
            </div>
          </div>
        )}

        {/* --- ユーザー詳細 (フレンド申請・DM) --- */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", width: "260px", padding: "25px", borderRadius: "25px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "70px", height: "70px", borderRadius: "20px", marginBottom: "10px" }} />
              <h4 style={{margin: "0 0 15px 0"}}>{selectedUser.name}</h4>
              {selectedUser.uid !== user.uid && (
                <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                  <button onClick={() => sendFriendRequest(selectedUser)} className={btnAni} style={{background:"#000", color:"#fff", padding:"12px", borderRadius:"12px"}}>フレンド申請を送る</button>
                  <button onClick={() => { setActiveDM(selectedUser); setPage("dm"); setSelectedUser(null); }} className={btnAni} style={{background:"#f0f0f0", padding:"12px", borderRadius:"12px"}}>DMを送る</button>
                  {user.uid === ADMIN_UID && (
                    <button onClick={async () => { if(confirm("BANしますか？")){ await updateDoc(doc(db, "users", selectedUser.uid), { isBanned: true }); setSelectedUser(null); } }} style={{color:"red", background:"none", border:"none", marginTop:"10px"}}>🚫 凍結する</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showTos && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>利用規約</h3>
              <p style={{fontSize:"13px", color:"#666"}}>荒らし、誹謗中傷、出会い目的の利用は禁止です。24時間で消滅する部屋を活用して、楽しくチャットしましょう。</p>
              <button onClick={() => setShowTos(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "10px" }}>閉じる</button>
            </div>
          </div>
        )}

        {user && (
          <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", height: "70px", zIndex: 50 }}>
            {[ {p:"home", i:"🏠"}, {p:"rooms", i:"💬"}, {p:"friends", i:"👥"}, {p:"profile", i:"👤"} ].map(item => (
              <button key={item.p} onClick={() => setPage(item.p)} className={btnAni} style={{ flex: 1, background: "none", color: page === item.p ? "#000" : "#ccc" }}>
                <div style={{fontSize: "24px"}}>{item.i}</div>
              </button>
            ))}
          </nav>
        )}

        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "70px", width: "100%", maxWidth: "500px", background: "#fff", padding: "10px", borderTop: "1px solid #eee", zIndex: 50 }}>
            {base64Image && (
              <div style={{position:"relative", marginBottom:"10px"}}>
                <img src={base64Image} style={{width:"60px", height:"60px", borderRadius:"10px"}} />
                <button onClick={() => setBase64Image("")} style={{position:"absolute", top:-5, left:50, background:"#000", color:"#fff", borderRadius:"50%", border:"none", width:"20px", height:"20px"}}>×</button>
              </div>
            )}
            <div style={{display: "flex", gap: "10px", alignItems:"center"}}>
              <button onClick={() => fileInputRef.current?.click()} style={{background:"#f0f0f0", border:"none", borderRadius:"50%", width:"40px", height:"40px", fontSize:"20px"}}>📷</button>
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
              <input value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, padding: "12px 15px", borderRadius: "25px", border: "1px solid #eee", outline:"none" }} />
              <button onClick={sendPost} className={btnAni} style={{ background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "25px", fontWeight: "bold" }}>送信</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}