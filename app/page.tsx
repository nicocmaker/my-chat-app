"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc, getDoc
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
  const [authMode, setAuthMode] = useState("signup"); // signup or login
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

  // 1. 認証とデータの監視
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
        // 通知監視（自分宛ての通知すべて）
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(10)), (s) => 
          setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        // フレンド監視
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid), where("status", "==", "accepted")), (s) => 
          setFriends(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubAuth();
  }, []);

  // 2. チャット/DM取得
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

  // 投稿送信
  const sendPost = async () => {
    if (!text.trim() && !imageUrl.trim()) return;
    const roomId = page === "dm" ? [user.uid, activeDM.uid].sort().join("_") : activeRoom.id;
    await addDoc(collection(db, "posts"), {
      text, image: imageUrl, room: roomId, senderUid: user.uid, name: myData.name, icon: myData.icon, createdAt: serverTimestamp(),
    });
    setText(""); setImageUrl("");
  };

  // フレンド申請
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

  // スタイル定数
  const btnAni = "active:scale-95 transition-transform duration-100 cursor-pointer border-none outline-none";
  const boxStyle = { border: "2px solid #000", padding: "15px", borderRadius: "15px", marginBottom: "20px" };

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "150px", fontFamily: "sans-serif" }}>
        <h1 style={{fontSize:"48px", marginBottom:"40px"}}>Chatia</h1>
        <button onClick={() => setPage("auth")} className={btnAni} style={{ padding: "15px 50px", borderRadius: "30px", background: "#000", color: "#fff", fontWeight: "bold", fontSize: "18px" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fcfcfc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 20px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", background: "#fff", position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b style={{ fontSize: "22px", letterSpacing: "-1px" }}>Chatia</b>
          {user && <span style={{fontSize:"11px", color:"#aaa", background:"#f5f5f5", padding:"4px 8px", borderRadius:"10px"}}>@{myData?.displayId}</span>}
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "160px" }}>
          
          {/* --- ホーム --- */}
          {page === "home" && (
            <div className="fade-in">
              <div style={{ padding: "30px 20px", background: "#000", color: "#fff", borderRadius: "20px", marginBottom: "30px" }}>
                <h2 style={{margin: 0, fontSize:"24px"}}>ようこそ、{myData?.name}さん</h2>
                <p style={{opacity:0.6, fontSize:"14px"}}>今日も楽しくチャットしましょう！</p>
              </div>

              <section style={boxStyle}>
                <h4 style={{margin: "0 0 12px 0", display:"flex", alignItems:"center", gap:"8px"}}>🔔 運営・システム通知</h4>
                {notifications.length === 0 ? <p style={{fontSize:"13px", color:"#bbb"}}>新しい通知はありません</p> : 
                  notifications.map(n => (
                    <div key={n.id} style={{fontSize:"14px", padding:"10px 0", borderBottom:"1px solid #f0f0f0"}}>
                      {n.text}
                      {n.type === "friend_request" && (
                        <button onClick={async () => {
                          const friendId = [user.uid, n.fromUid].sort().join("_");
                          await updateDoc(doc(db, "friends", friendId), { status: "accepted" });
                          await deleteDoc(doc(db, "notifications", n.id));
                          alert("フレンドになりました！");
                        }} className={btnAni} style={{background:"#000", color:"#fff", fontSize:"11px", padding:"4px 10px", borderRadius:"5px", marginLeft:"10px"}}>承認</button>
                      )}
                    </div>
                  ))
                }
              </section>

              <section style={boxStyle}>
                <h4 style={{margin: "0 0 12px 0"}}>📜 利用規約</h4>
                <p style={{fontSize:"13px", color:"#777", marginBottom:"15px"}}>全てのユーザーが快適に過ごすためのルールです。</p>
                <button onClick={() => setShowTos(true)} className={btnAni} style={{ background: "#f0f0f0", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>規約を全文表示</button>
              </section>

              <section>
                <h4 style={{marginBottom:"10px"}}>📩 お問い合わせ</h4>
                <button className={btnAni} style={{ background: "#fff", border:"1px solid #eee", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>公式サポートへ</button>
              </section>
            </div>
          )}

          {/* --- ルーム一覧 --- */}
          {page === "rooms" && (
            <div>
              <div style={{background: "#f9f9f9", padding: "20px", borderRadius: "15px", marginBottom: "25px"}}>
                <h4 style={{margin: "0 0 15px 0"}}>新しい部屋を作成</h4>
                <input placeholder="部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <input placeholder="パスワード (任意)" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} style={{width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <button onClick={async () => {
                  if(newRoomName) { await addDoc(collection(db, "rooms"), { name: newRoomName, password: newRoomPass, createdAt: serverTimestamp() }); setNewRoomName(""); setNewRoomPass(""); }
                }} className={btnAni} style={{background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold"}}>作成</button>
              </div>
              <h3 style={{marginBottom:"15px"}}>公開ルーム</h3>
              {rooms.map(r => (
                <div key={r.id} onClick={() => {
                  if(r.password) { const p = prompt("パスワードを入力"); if(p !== r.password) return alert("違います"); }
                  setActiveRoom(r); setPage("chat");
                }} className={btnAni} style={{ padding: "18px", border: "1px solid #eee", borderRadius: "15px", marginBottom: "12px", background:"#fff", display: "flex", justifyContent: "space-between" }}>
                  <b># {r.name}</b> {r.password && "🔒"}
                </div>
              ))}
            </div>
          )}

          {/* --- プロフィール --- */}
          {page === "profile" && (
            <div style={{ textAlign: "center", paddingTop:"20px" }}>
              <img src={myData?.icon} style={{ width: "100px", height: "100px", borderRadius: "30px", marginBottom: "20px", objectFit: "cover", boxShadow:"0 5px 15px rgba(0,0,0,0.1)" }} />
              <div style={{ marginBottom: "20px", textAlign: "left" }}>
                <label style={{fontSize: "12px", color: "#888", fontWeight:"bold"}}>ユーザー名</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop:"5px" }} />
              </div>
              <div style={{ marginBottom: "30px", textAlign: "left" }}>
                <label style={{fontSize: "12px", color: "#888", fontWeight:"bold"}}>アイコン画像URL</label>
                <input value={editIcon} onChange={e => setEditIcon(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop:"5px" }} />
              </div>
              <button onClick={async () => {
                await updateDoc(doc(db, "users", user.uid), { name: editName, icon: editIcon });
                alert("保存しました");
              }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "12px", fontWeight: "bold" }}>変更を保存</button>
              
              <button onClick={() => signOut(auth)} className={btnAni} style={{ color: "#ff4d4d", background: "none", marginTop: "50px", fontSize: "14px", fontWeight:"bold" }}>ログアウト</button>
            </div>
          )}

          {/* --- チャット・DM画面 --- */}
          {(page === "chat" || page === "dm") && (
            <div className="fade-in">
              <button onClick={() => setPage(page === "dm" ? "friends" : "rooms")} className={btnAni} style={{marginBottom: "20px", background:"#f0f0f0", padding:"8px 15px", borderRadius:"20px", fontSize:"13px"}}>← 戻る</button>
              <div style={{ display: "flex", flexDirection: "column-reverse" }}>
                {posts.map(p => (
                  <div key={p.id} style={{ display: "flex", gap: "12px", padding: "15px 0", borderBottom: "1px solid #f9f9f9" }}>
                    <img src={p.icon || DEFAULT_ICON} style={{ width: "42px", height: "42px", borderRadius: "12px", objectFit: "cover", cursor:"pointer" }} 
                      onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{flex: 1}}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems:"center"}}>
                        <b style={{fontSize: "13px"}}>{p.name}</b>
                        {(user.uid === ADMIN_UID || p.senderUid === user.uid) && (
                          <button onClick={async () => { if(confirm("消去しますか？")) await deleteDoc(doc(db, "posts", p.id)); }} style={{background:"none", border:"none", color:"#ddd", cursor:"pointer"}}>✕</button>
                        )}
                      </div>
                      <p style={{margin: "5px 0", fontSize: "15px", lineHeight:"1.5"}}>{p.text}</p>
                      {p.image && <img src={p.image} style={{maxWidth: "100%", borderRadius: "12px", marginTop: "8px", border:"1px solid #eee"}} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- フレンド --- */}
          {page === "friends" && (
            <div>
              <h3 style={{marginBottom: "20px"}}>フレンドリスト</h3>
              {friends.length === 0 ? <p style={{textAlign:"center", color:"#ccc", marginTop:"40px"}}>フレンドがいません</p> : 
                friends.map(f => {
                  const fData = allUsers.find(u => u.uid === f.uids.find((id:any) => id !== user.uid));
                  return fData && (
                    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", borderBottom: "1px solid #f5f5f5" }}>
                      <div style={{display:"flex", alignItems:"center", gap:"12px"}}>
                        <img src={fData.icon} style={{width:"45px", height:"45px", borderRadius:"15px", objectFit: "cover"}} />
                        <b style={{fontSize:"16px"}}>{fData.name}</b>
                      </div>
                      <button onClick={() => { setActiveDM(fData); setPage("dm"); }} className={btnAni} style={{background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "bold"}}>DM</button>
                    </div>
                  );
                })
              }
            </div>
          )}

          {/* --- ログイン・登録画面 --- */}
          {page === "auth" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <h2 style={{marginBottom:"30px"}}>{authMode === "signup" ? "新規アカウント作成" : "ログイン"}</h2>
              <input placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "12px", borderRadius: "12px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "20px", borderRadius: "12px", border: "1px solid #ddd" }} />
              
              {authMode === "signup" ? (
                <button onClick={async () => {
                  const email = `${username}@chatia.app`;
                  try {
                    const res = await createUserWithEmailAndPassword(auth, email, password);
                    await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false });
                    setPage("home");
                  } catch(e) { alert("作成に失敗しました（名前が短いか既に使用されています）"); }
                }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "12px", fontWeight: "bold" }}>登録してはじめる</button>
              ) : (
                <button onClick={async () => {
                  const email = `${username}@chatia.app`;
                  try {
                    await signInWithEmailAndPassword(auth, email, password);
                    setPage("home");
                  } catch(e) { alert("ログインに失敗しました"); }
                }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "12px", fontWeight: "bold" }}>ログイン</button>
              )}
              
              <p onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")} style={{marginTop:"30px", fontSize:"13px", color:"#888", textDecoration:"underline", cursor:"pointer"}}>
                {authMode === "signup" ? "既にアカウントをお持ちの方はこちら" : "新しくアカウントを作る方はこちら"}
              </p>
            </div>
          )}
        </div>

        {/* --- 利用規約モーダル --- */}
        {showTos && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding:"20px" }}>
            <div style={{ background: "#fff", width: "100%", maxWidth:"400px", padding: "30px", borderRadius: "25px" }}>
              <h3 style={{marginTop: 0, fontSize:"20px"}}>利用規約</h3>
              <div style={{ fontSize: "14px", maxHeight: "300px", overflowY: "auto", color: "#555", lineHeight: "1.8" }}>
                1. 誹謗中傷の禁止：他者を攻撃する内容の投稿を禁じます。<br/>
                2. 出会い目的の禁止：本サービス内での個人情報の交換を禁じます。<br/>
                3. 荒らしの禁止：過度な連投や無意味な投稿を禁じます。<br/>
                4. 著作権の尊重：他者の権利を侵害する画像の投稿を禁じます。<br/>
                ※違反者は運営の判断により即時BAN（凍結）となります。
              </div>
              <button onClick={() => setShowTos(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "30px", borderRadius: "12px", fontWeight: "bold" }}>同意して閉じる</button>
            </div>
          </div>
        )}

        {/* --- ユーザー詳細/申請モーダル --- */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zContext: 100, display: "flex", justifyContent: "center", alignItems: "center" }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", width: "80%", maxWidth:"300px", padding: "30px", borderRadius: "25px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "80px", height: "80px", borderRadius: "25px", marginBottom: "15px", objectFit: "cover" }} />
              <h3 style={{margin: "0 0 5px 0"}}>{selectedUser.name}</h3>
              <p style={{fontSize:"12px", color:"#999", marginBottom:"25px"}}>@{selectedUser.displayId}</p>
              
              {selectedUser.uid !== user.uid && (
                <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                  <button onClick={() => sendFriendRequest(selectedUser)} className={btnAni} style={{background: "#000", color: "#fff", padding: "12px", borderRadius: "10px", width: "100%", fontWeight:"bold"}}>フレンド申請を送る</button>
                  <button onClick={() => { setActiveDM(selectedUser); setPage("dm"); setSelectedUser(null); }} className={btnAni} style={{background: "#f0f0f0", color: "#000", padding: "12px", borderRadius: "10px", width: "100%", fontWeight:"bold"}}>DMを送る</button>
                  {user.uid === ADMIN_UID && (
                    <button onClick={async () => { if(confirm("BANしますか？")) await updateDoc(doc(db, "users", selectedUser.uid), {isBanned: true}); }} style={{color:"red", background:"none", border:"none", marginTop:"10px", fontSize:"12px"}}>🚫 ユーザーをBANする</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- 下部ナビ --- */}
        {user && (
          <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", background: "rgba(255,255,255,0.95)", backdropFilter:"blur(10px)", borderTop: "1px solid #f0f0f0", height: "80px", paddingBottom: "10px" }}>
            {["home", "rooms", "friends", "profile"].map(p => (
              <button key={p} onClick={() => setPage(p)} className={btnAni} style={{ flex: 1, background: "none", color: page === p ? "#000" : "#ccc" }}>
                <div style={{fontSize: "24px", marginBottom:"2px"}}>{p === "home" ? "🏠" : p === "rooms" ? "💬" : p === "friends" ? "👥" : "👤"}</div>
                <div style={{fontSize: "10px", fontWeight: "bold"}}>{p === "home" ? "ホーム" : p === "rooms" ? "チャット" : p === "friends" ? "フレンド" : "自分"}</div>
              </button>
            ))}
          </nav>
        )}

        {/* --- 投稿バー --- */}
        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "80px", width: "100%", maxWidth: "500px", background: "#fff", padding: "15px", borderTop: "1px solid #f0f0f0", boxShadow: "0 -5px 15px rgba(0,0,0,0.03)" }}>
            <div style={{display:"flex", alignItems:"center", background:"#f5f5f5", borderRadius:"25px", padding:"5px 15px", marginBottom:"10px"}}>
               <span style={{fontSize:"12px", color:"#aaa", marginRight:"10px"}}>URL:</span>
               <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="画像のURLを貼り付け" style={{ flex:1, fontSize: "12px", border: "none", background:"none", outline: "none", padding:"8px 0" }} />
            </div>
            <div style={{display: "flex", gap: "10px"}}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, padding: "12px 20px", borderRadius: "25px", border: "1px solid #eee", background: "#fff", outline: "none", fontSize:"15px" }} />
              <button onClick={sendPost} className={btnAni} style={{ background: "#000", color: "#fff", width:"50px", height:"50px", borderRadius: "50%", display:"flex", justifyContent:"center", alignItems:"center", fontSize:"18px" }}>➤</button>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .fade-in { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}