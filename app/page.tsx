"use client";

import { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, limit, where, setDoc
} from "firebase/firestore";
import { auth, db } from "@/firebase";

const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const ADMIN_UID = "KRs1odbdqscs6ZFJsq5YcHo9TtO2"; 
const ADMIN_EMAIL = "chamusandao@gmail.com"; // ここにあなたのアドレスを

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
  const [newRoomPass, setNewRoomPass] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  
  const [showTos, setShowTos] = useState(false);
  const [showAdminNotif, setShowAdminNotif] = useState(false);
  const [showContact, setShowContact] = useState(false);
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
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(10)), (s) => 
          setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid), where("status", "==", "accepted")), (s) => 
          setFriends(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    });
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
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
    const roomId = page === "dm" ? [user.uid, activeDM.uid].sort().join("_") : activeRoom.id;
    await addDoc(collection(db, "posts"), {
      text, image: base64Image, room: roomId, senderUid: user.uid, name: myData.name, icon: myData.icon, createdAt: serverTimestamp(),
    });
    if (page === "dm") {
      await addDoc(collection(db, "notifications"), {
        toUid: activeDM.uid, text: `${myData.name}さんからDMが届きました`, fromUid: user.uid, type: "dm", createdAt: serverTimestamp()
      });
    }
    setText(""); setBase64Image("");
  };

  const btnAni = "active:scale-95 transition-transform duration-100 cursor-pointer border-none outline-none";

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "150px" }}>
        <h1>Chatia</h1>
        <button onClick={() => setPage("auth")} className={btnAni} style={{ padding: "12px 30px", borderRadius: "25px", background: "#000", color: "#fff" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#fcfcfc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", position: "sticky", top: 0, zIndex: 100 }}>
          <b style={{fontSize:"20px"}}>Chatia</b>
          <div style={{position: "relative"}} onClick={() => setShowNotifs(true)} className={btnAni}>
            <span style={{fontSize: "24px"}}>🔔</span>
            {notifications.length > 0 && (
              <span style={{position: "absolute", top: -5, right: -5, background: "red", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", fontWeight: "bold"}}>
                {notifications.length}
              </span>
            )}
          </div>
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "160px" }}>
          
          {page === "home" && (
            <div>
              <div style={{ padding: "20px", background: "#000", color: "#fff", borderRadius: "15px", marginBottom: "25px" }}>
                <h3 style={{margin: 0}}>ようこそ、{myData?.name}さん</h3>
              </div>

              <div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
                <button onClick={() => setShowAdminNotif(true)} className={btnAni} style={{ padding: "15px", background: "#f5f5f5", borderRadius: "12px", fontWeight: "bold", textAlign: "left" }}>📢 運営通知を表示</button>
                <button onClick={() => setShowTos(true)} className={btnAni} style={{ padding: "15px", background: "#f5f5f5", borderRadius: "12px", fontWeight: "bold", textAlign: "left" }}>📜 利用規約を表示</button>
                <button onClick={() => setShowContact(true)} className={btnAni} style={{ padding: "15px", background: "#f5f5f5", borderRadius: "12px", fontWeight: "bold", textAlign: "left" }}>📩 お問い合わせ先</button>
              </div>

              <section style={{marginTop: "30px", padding: "15px", border: "1px solid #eee", borderRadius: "15px"}}>
                <h4 style={{margin: "0 0 10px 0"}}>📜 ホーム表示用規約</h4>
                <div style={{ fontSize: "12px", color: "#666", lineHeight: "1.6" }}>
                  1. 誹謗中傷、嫌がらせ禁止。<br/>
                  2. 24時間で全ての部屋が自動削除されます。
                </div>
              </section>
            </div>
          )}

          {page === "rooms" && (
            <div>
              <div style={{background: "#f9f9f9", padding: "15px", borderRadius: "15px", marginBottom: "20px"}}>
                <input placeholder="部屋名（24時間で消えます）" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <input placeholder="パスワード (空なら誰でも入れます)" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} style={{width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd"}} />
                <button onClick={async () => {
                  if(newRoomName) { await addDoc(collection(db, "rooms"), { name: newRoomName, password: newRoomPass, createdAt: serverTimestamp() }); setNewRoomName(""); setNewRoomPass(""); }
                }} className={btnAni} style={{background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold"}}>部屋を作成</button>
              </div>
              {rooms.map(r => (
                <div key={r.id} onClick={() => {
                  if(r.password) { const p = prompt("パスワードを入力してください"); if(p !== r.password) { alert("不一致です"); return; } }
                  setActiveRoom(r); setPage("chat");
                }} className={btnAni} style={{ padding: "18px", border: "1px solid #eee", borderRadius: "15px", marginBottom: "10px", background: "#fff", display: "flex", justifyContent: "space-between" }}>
                  <b># {r.name}</b>
                  {r.password && <span>🔒</span>}
                </div>
              ))}
            </div>
          )}

          {page === "friends" && (
            <div>
              <h3>フレンド</h3>
              {friends.map(f => {
                const fData = allUsers.find(u => u.uid === f.uids.find((id:any) => id !== user.uid));
                return fData && (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", borderBottom: "1px solid #eee" }}>
                    <b>{fData.name}</b>
                    <button onClick={() => { setActiveDM(fData); setPage("dm"); }} className={btnAni} style={{background: "#000", color: "#fff", padding: "8px 20px", borderRadius: "10px"}}>DM</button>
                  </div>
                );
              })}
            </div>
          )}

         {page === "profile" && (
  <div style={{ textAlign: "center" }}>
    {/* アイコン表示部分（クリックでファイル選択も可能に） */}
    <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 20px" }}>
      <img 
        src={editIcon || myData?.icon || DEFAULT_ICON} 
        style={{ width: "80px", height: "80px", borderRadius: "20px", objectFit: "cover", border: "1px solid #eee" }} 
      />
      <label style={{ 
        position: "absolute", bottom: "-5px", right: "-5px", background: "#000", color: "#fff", 
        width: "28px", height: "28px", borderRadius: "50%", display: "flex", justifyContent: "center", 
        alignItems: "center", cursor: "pointer", fontSize: "14px", border: "2px solid #fff" 
      }}>
        📷
        <input 
          type="file" 
          hidden 
          accept="image/*" 
          onChange={(e: any) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => setEditIcon(reader.result as string); // Base64形式でセット
              reader.readAsDataURL(file);
            }
          }} 
        />
      </label>
    </div>

    {/* 名前入力 */}
    <input 
      value={editName} 
      onChange={e => setEditName(e.target.value)} 
      placeholder="名前"
      style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom:"10px" }} 
    />

    {/* 保存ボタン */}
    <button 
      onClick={async () => { 
        await updateDoc(doc(db, "users", user.uid), { name: editName, icon: editIcon || myData?.icon || DEFAULT_ICON }); 
        alert("保存しました！"); 
      }} 
      className={btnAni} 
      style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}
    >
      保存
    </button>

    <button onClick={() => signOut(auth)} className={btnAni} style={{ color: "red", background: "none", marginTop: "40px" }}>
      ログアウト
    </button>
  </div>
)}

          {(page === "chat" || page === "dm") && (
  <div>
    <button onClick={() => setPage(page === "dm" ? "friends" : "rooms")} className={btnAni} style={{marginBottom:"15px", background:"#f0f0f0", padding:"5px 15px", borderRadius:"10px"}}>← 戻る</button>
    <div style={{ display: "flex", flexDirection: "column-reverse" }}>
      {posts.map(p => (
        <div key={p.id} style={{ display: "flex", gap: "10px", padding: "12px 0", borderBottom: "1px solid #f9f9f9" }}>
          {/* アイコン：objectFit追加で画像が伸びないように修正 */}
          <img 
            src={p.icon || DEFAULT_ICON} 
            style={{ width: "42px", height: "42px", borderRadius: "12px", cursor:"pointer", objectFit: "cover" }} 
            onClick={() => { const found = allUsers.find(u => u.uid === p.senderUid); if(found) setSelectedUser(found); }} 
          />
          <div style={{flex:1}}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{fontSize:"12px"}}>{p.name}</b>
              {/* --- 日時表示を追加 --- */}
              <span style={{fontSize:"10px", color:"#aaa"}}>
                {p.createdAt?.toDate 
                  ? p.createdAt.toDate().toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
                  : "..."}
              </span>
            </div>
            {/* 改行が反映されるように whiteSpace を追加 */}
            <p style={{margin:"2px 0", fontSize:"15px", whiteSpace: "pre-wrap", color: "#333"}}>{p.text}</p>
            {p.image && <img src={p.image} style={{maxWidth: "100%", borderRadius: "10px", marginTop:"8px", border: "1px solid #eee"}} />}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

          {page === "auth" && (
            <div style={{ padding: "40px 10px", textAlign: "center" }}>
              <h2>{authMode === "signup" ? "新規作成" : "ログイン"}</h2>
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
                } catch(e) { alert("失敗しました"); }
              }} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "15px", borderRadius: "10px" }}>確定</button>
              <p onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")} style={{marginTop:"20px", textDecoration:"underline"}}>{authMode === "signup" ? "ログイン" : "新規作成"}</p>
            </div>
          )}
        </div>

        {/* --- 通知ポップアップ (右上ベルから起動) --- */}
        {showNotifs && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>🔔 通知</h3>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {notifications.length === 0 ? <p style={{color:"#999"}}>通知はありません</p> : 
                  notifications.map(n => (
                    <div key={n.id} style={{fontSize:"13px", padding:"12px 0", borderBottom:"1px solid #f0f0f0"}}>
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

        {/* --- 運営通知モーダル --- */}
        {showAdminNotif && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>📢 運営通知</h3>
              <div style={{ fontSize: "14px", color: "#333", lineHeight: "1.6" }}>
                ・新機能「パスワード付きルーム」を追加しました！<br/>
                ・画像送信がアルバムから直接できるようになりました。<br/>
                ・通知が右上のベルボタンに集約されました。
              </div>
              <button onClick={() => setShowAdminNotif(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "10px" }}>閉じる</button>
            </div>
          </div>
        )}

        {/* --- 利用規約モーダル --- */}
        {showTos && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px" }}>
              <h3 style={{marginTop: 0}}>📜 利用規約</h3>
              <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.6" }}>
                利用規約<br/>
本利用規約（以下「本規約」）は、本チャットサイト（以下「本サービス」）の利用条件を定めるものです。利用者は本サービスを利用することで、本規約に同意したものとみなします。<br/><br/>

第1条（適用）<br/>
本規約は、利用者と運営者との間の本サービス利用に関わる一切の関係に適用されます。<br/><br/>

第2条（禁止事項）<br/>
利用者は以下の行為をしてはなりません。<br/>
・法令または公序良俗に違反する行為<br/>
・他者への誹謗中傷、嫌がらせ、脅迫<br/>
・個人情報（住所・電話番号・メール等）の無断公開<br/>
・なりすまし行為<br/>
・スパム投稿や荒らし行為<br/>
・不正アクセスやシステムへの攻撃<br/>
・その他運営が不適切と判断する行為<br/><br/>

第3条（アカウント管理）<br/>
利用者は自己の責任においてアカウント情報を管理するものとし、第三者への貸与・譲渡は禁止します。<br/><br/>

第4条（投稿内容）<br/>
投稿されたコンテンツの責任はすべて投稿者に帰属します。運営は必要に応じて投稿内容を削除・非表示にできるものとします。<br/><br/>

第5条（サービスの停止・変更）<br/>
運営者は、事前の通知なく本サービスの全部または一部を変更・停止・終了できるものとします。<br/><br/>

第6条（免責事項）<br/>
本サービスの利用により発生したいかなる損害についても、運営者は一切の責任を負いません。<br/><br/>

第7条（規約の変更）<br/>
運営者は必要に応じて本規約を変更できるものとし、変更後も本サービスを利用した場合は同意したものとみなします。<br/><br/><br/>・24時間でデータはリセットされます。
              </div>
              <button onClick={() => setShowTos(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "10px" }}>同意して閉じる</button>
            </div>
          </div>
        )}

        {/* --- お問い合わせモーダル --- */}
        {showContact && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#fff", width: "85%", padding: "20px", borderRadius: "20px", textAlign: "center" }}>
              <h3 style={{marginTop: 0}}>📩 お問い合わせ</h3>
              <p style={{fontSize: "14px", color: "#333"}}>不具合や要望はこちらまで</p>
              <b style={{fontSize: "16px", color: "#000"}}>{ADMIN_EMAIL}</b>
              <button onClick={() => setShowContact(false)} className={btnAni} style={{ background: "#000", color: "#fff", width: "100%", padding: "12px", marginTop: "20px", borderRadius: "10px" }}>閉じる</button>
            </div>
          </div>
        )}

        {/* --- ユーザー詳細ポップアップ --- */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center" }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", width: "250px", padding: "20px", borderRadius: "20px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "60px", height: "60px", borderRadius: "15px", marginBottom: "10px" }} />
              <h4>{selectedUser.name}</h4>
              {selectedUser.uid !== user.uid && (
                <div style={{display:"flex", flexDirection:"column", gap:"8px"}}>
                  <button onClick={async () => {
                    const friendId = [user.uid, selectedUser.uid].sort().join("_");
                    await setDoc(doc(db, "friends", friendId), { uids: [user.uid, selectedUser.uid], status: "pending", from: user.uid, createdAt: serverTimestamp() });
                    await addDoc(collection(db, "notifications"), { toUid: selectedUser.uid, text: `${myData.name}さんからフレンド申請`, type: "friend_request", fromUid: user.uid, createdAt: serverTimestamp() });
                    alert("申請しました"); setSelectedUser(null);
                  }} className={btnAni} style={{background:"#000", color:"#fff", padding:"10px", borderRadius:"8px"}}>フレンド申請</button>
                  <button onClick={() => { setActiveDM(selectedUser); setPage("dm"); setSelectedUser(null); }} className={btnAni} style={{background:"#eee", padding:"10px", borderRadius:"8px"}}>DMを送る</button>
                  {user.uid === ADMIN_UID && (
                    <button onClick={async () => { if(confirm("BANしますか？")) { await updateDoc(doc(db, "users", selectedUser.uid), { isBanned: true }); setSelectedUser(null); } }} style={{color:"red", background:"none", border:"none", marginTop:"15px", fontWeight:"bold"}}>🚫 凍結(BAN)する</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {user && (
  <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", background: "#fff", borderTop: "1px solid #eee", height: "70px", zIndex: 100 }}>
    {["home", "rooms", "friends", "profile"].map(p => (
      <button key={p} onClick={() => setPage(p)} className={btnAni} style={{ flex: 1, background: "none", color: page === p ? "#000" : "#ccc" }}>
        <div style={{fontSize: "14px", fontWeight: "bold"}}>
          {p === "home" && "ホーム"}
          {p === "rooms" && "部屋"}
          {p === "friends" && "友達"}
          {p === "profile" && "プロフ"}
        </div>
      </button>
    ))}
  </nav>
)}

        {(page === "chat" || page === "dm") && (
          <div style={{ position: "fixed", bottom: "70px", width: "100%", maxWidth: "500px", background: "#fff", padding: "10px", borderTop: "1px solid #eee", zIndex: 100 }}>
            {base64Image && <div style={{position:"relative"}}><img src={base64Image} style={{width:"50px", height:"50px", borderRadius:"5px", marginBottom:"5px"}} /><button onClick={()=>setBase64Image("")} style={{position:"absolute", top:0, left:40, background:"#000", color:"#fff", borderRadius:"50%", border:"none", width:"20px", height:"20px"}}>×</button></div>}
            <div style={{display: "flex", gap: "10px", alignItems:"center"}}>
              <button onClick={() => fileInputRef.current?.click()} style={{background:"#f0f0f0", border:"none", borderRadius:"50%", width:"35px", height:"35px"}}>📷</button>
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
              <input value={text} onChange={e => setText(e.target.value)} placeholder="メッセージ" style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #eee", outline: "none" }} />
              <button onClick={sendPost} className={btnAni} style={{ background: "#000", color: "#fff", padding: "8px 15px", borderRadius: "20px", fontWeight: "bold" }}>送信</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}