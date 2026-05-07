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
const ADMIN_UID = "brB1fXAZbwMXiMfMclroekYNVIw1"; // あなたのUID

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
  const [text, setText] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPass, setNewRoomPass] = useState("");
  const [username, setUsername] = useState(""); 
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [agreedToTos, setAgreedToTos] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // 自分のデータ監視
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.isBanned) { 
              alert("凍結されています。");
              signOut(auth); 
              return; 
            }
            setMyData(data);
            setEditName(data.name);
          }
        });
        // 運営通知の監視
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid), orderBy("createdAt", "desc"), limit(5)), (s) => 
          setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        // フレンドの監視
        onSnapshot(query(collection(db, "friends"), where("uids", "array-contains", u.uid)), (s) => 
          setFriends(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );
      }
    });
    // 全ユーザー・全部屋の監視
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (s) => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubAuth();
  }, []);

  // チャット投稿監視
  useEffect(() => {
    if (page === "chat" && activeRoom) {
      const q = query(collection(db, "posts"), where("room", "==", activeRoom.id), orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(q, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [page, activeRoom]);

  const sendPost = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "posts"), {
      text, room: activeRoom.id, senderUid: user.uid, name: myData.name, icon: myData.icon, displayId: myData.displayId, createdAt: serverTimestamp(), isSystem: user.uid === ADMIN_UID,
    });
    setText("");
  };

  const addFriend = async (target: any) => {
    const isAlready = friends.some(f => f.uids.includes(target.uid));
    if(isAlready) return alert("既にフレンドです");
    await addDoc(collection(db, "friends"), { uids: [user.uid, target.uid], createdAt: serverTimestamp() });
    alert(`${target.name}さんとフレンドになりました！`);
  };

  const sendAdminNotification = async (targetUid: string) => {
    const msg = prompt("運営通知の内容を入力してください");
    if (!msg) return;
    await addDoc(collection(db, "notifications"), {
      toUid: targetUid, text: `【運営】${msg}`, createdAt: serverTimestamp()
    });
    alert("送信完了");
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", border: "none", outline: "none", transition: "0.1s" };

  if (!user && page !== "auth") {
    return (
      <div style={{ textAlign: "center", paddingTop: "100px", fontFamily: "sans-serif" }}>
        <h1 style={{fontSize: "40px", marginBottom: "10px"}}>Chatia</h1>
        <p style={{color: "#888", marginBottom: "30px"}}>次世代のシンプルチャット</p>
        <button onClick={() => setPage("auth")} style={{ padding: "15px 40px", borderRadius: "30px", ...btnStyle, background: "#000", color: "#fff", fontWeight: "bold" }}>はじめる</button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", color: "#333" }}>
      <style>{`.btn-ani:active { transform: scale(0.95); opacity: 0.8; } .admin-tag { background: #ff4d4f; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 5px; }`}</style>
      
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 20px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <b style={{ fontSize: "20px", cursor: "pointer" }} onClick={() => setPage("home")}>Chatia</b>
          {user && <span style={{fontSize: "12px", background: "#eee", padding: "4px 10px", borderRadius: "15px"}}>@{myData?.displayId}</span>}
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "160px" }}>
          
          {page === "home" && (
            <div>
              <div style={{ padding: "30px 20px", background: "linear-gradient(135deg, #000, #444)", color: "#fff", borderRadius: "20px", marginBottom: "25px" }}>
                <h2 style={{margin: 0}}>ようこそ、{myData?.name}さん</h2>
                <p style={{ opacity: 0.7, fontSize: "14px" }}>今日も楽しくおしゃべりしましょう！</p>
              </div>

              <section style={{marginBottom: "25px"}}>
                <h4 style={{marginBottom: "10px", display: "flex", alignItems: "center"}}>🔔 運営通知</h4>
                {notifications.length === 0 ? <p style={{fontSize: "13px", color: "#999"}}>通知はありません</p> : 
                  notifications.map(n => (
                    <div key={n.id} style={{ background: "#fff5f5", borderLeft: "4px solid #ff4d4f", padding: "12px", borderRadius: "8px", marginBottom: "8px", fontSize: "14px" }}>{n.text}</div>
                  ))
                }
              </section>

              <section>
                <h4 style={{marginBottom: "10px"}}>👥 フレンド ({friends.length})</h4>
                <div style={{display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px"}}>
                  {friends.length === 0 && <p style={{fontSize: "13px", color: "#999"}}>まだフレンドがいません</p>}
                  {friends.map(f => {
                    const friendUid = f.uids.find((id: string) => id !== user.uid);
                    const friendData = allUsers.find(u => u.uid === friendUid);
                    return friendData ? (
                      <div key={f.id} style={{textAlign: "center", minWidth: "60px"}}>
                        <img src={friendData.icon} style={{width: "50px", height: "50px", borderRadius: "50%", border: "2px solid #eee"}} />
                        <div style={{fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{friendData.name}</div>
                      </div>
                    ) : null;
                  })}
                </div>
              </section>
            </div>
          )}

          {page === "rooms" && (
            <div>
              <h3 style={{fontSize: "18px"}}>部屋を作成</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px", background: "#f9f9f9", padding: "15px", borderRadius: "15px" }}>
                <input placeholder="部屋の名前" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} />
                <input placeholder="パスワード (任意)" value={newRoomPass} onChange={e => setNewRoomPass(e.target.value)} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} />
                <button onClick={async () => { if(newRoomName){ await addDoc(collection(db, "rooms"), { name: newRoomName, password: newRoomPass, createdAt: serverTimestamp() }); setNewRoomName(""); setNewRoomPass(""); } }} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>作成する</button>
              </div>
              <h3 style={{fontSize: "18px"}}>部屋に参加</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {rooms.map(r => (
                  <div key={r.id} onClick={() => {
                    if(r.password) { const p = prompt("パスワードを入力"); if(p !== r.password) return alert("パスワードが違います"); }
                    setActiveRoom(r); setPage("chat");
                  }} className="btn-ani" style={{ background: "#fff", padding: "20px", borderRadius: "15px", border: "1px solid #eee", textAlign: "center", cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.02)" }}>
                    <div style={{fontSize: "24px", marginBottom: "5px"}}>{r.password ? "🔒" : "💬"}</div>
                    <b style={{fontSize: "14px"}}>{r.name}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "chat" && activeRoom && (
            <div>
              <div style={{display: "flex", alignItems: "center", marginBottom: "20px", gap: "10px"}}>
                <button onClick={() => setPage("rooms")} style={{ ...btnStyle, background: "#eee", padding: "8px 15px", borderRadius: "20px", fontSize: "14px" }}>← 戻る</button>
                <b style={{fontSize: "18px"}}># {activeRoom.name}</b>
              </div>
              <div style={{ display: "flex", flexDirection: "column-reverse" }}>
                {posts.length === 0 && <p style={{textAlign: "center", color: "#999", padding: "40px"}}>まだ投稿がありません。<br/>最初のメッセージを送りましょう！</p>}
                {posts.map(p => (
                  <div key={p.id} style={{ display: "flex", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f9f9f9" }}>
                    <img src={p.icon || DEFAULT_ICON} style={{ width: "42px", height: "42px", borderRadius: "12px", cursor: "pointer", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid))} />
                    <div style={{ flex: 1 }}>
                      <div style={{display: "flex", alignItems: "center"}}>
                        <b style={{ fontSize: "13px" }}>{p.name}</b>
                        {p.isSystem && <span className="admin-tag">運営</span>}
                      </div>
                      <p style={{ margin: "4px 0", fontSize: "15px", lineHeight: "1.4" }}>{p.text}</p>
                    </div>
                    {user?.uid === ADMIN_UID && (
                      <button onClick={async () => {if(confirm("削除しますか？")) await deleteDoc(doc(db, "posts", p.id))}} style={{ ...btnStyle, background: "none", color: "#ccc" }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "tos" && (
            <div>
              <h3 style={{textAlign: "center", marginBottom: "20px"}}>📜 利用規約</h3>
              <div style={{ background: "#fff", border: "1px solid #eee", padding: "20px", borderRadius: "15px", fontSize: "14px", color: "#555", lineHeight: "1.8" }}>
                <p><b>1. 誹謗中傷の禁止</b><br/>他者を不快にする投稿、攻撃的な言葉の使用を禁止します。</p>
                <p><b>2. 個人情報の保護</b><br/>自分や他人の住所、電話番号などを公開しないでください。</p>
                <p><b>3. コンテンツの削除</b><br/>運営は不適切と判断した投稿を予告なく削除できるものとします。</p>
                <p><b>4. アカウント凍結</b><br/>規約に違反した場合、即座にBAN対象となります。</p>
              </div>
            </div>
          )}

          {page === "profile" && (
            <div>
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <img src={myData?.icon} style={{ width: "100px", height: "100px", borderRadius: "50%", border: "4px solid #fff", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }} />
                <div style={{ marginTop: "15px" }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: "20px", fontWeight: "bold", textAlign: "center", border: "none", borderBottom: "2px solid #000", width: "80%", background: "none" }} />
                  <p style={{ color: "#999", marginTop: "5px" }}>@{myData?.displayId}</p>
                </div>
              </div>
              <button onClick={async () => { await updateDoc(doc(db, "users", user.uid), { name: editName }); alert("保存しました"); }} className="btn-ani" style={{ ...btnStyle, width: "100%", background: "#000", color: "#fff", padding: "15px", borderRadius: "15px", fontWeight: "bold" }}>名前を保存</button>
              <button onClick={() => signOut(auth)} style={{ ...btnStyle, color: "#ff4d4f", width: "100%", marginTop: "30px", background: "none", fontSize: "14px" }}>ログアウト</button>
            </div>
          )}

          {page === "auth" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <h2 style={{fontSize: "28px", marginBottom: "30px"}}>新規登録</h2>
              <input placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "85%", padding: "15px", marginBottom: "15px", borderRadius: "12px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "85%", padding: "15px", marginBottom: "15px", borderRadius: "12px", border: "1px solid #ddd" }} />
              
              <div style={{marginBottom: "20px", fontSize: "13px", color: "#666"}}>
                <input type="checkbox" checked={agreedToTos} onChange={e => setAgreedToTos(e.target.checked)} id="tos-check" />
                <label htmlFor="tos-check" style={{marginLeft: "8px"}}>利用規約に同意する</label>
                <span style={{color: "#007aff", marginLeft: "10px", cursor: "pointer"}} onClick={() => setPage("tos")}>規約を見る</span>
              </div>

              <button onClick={async () => {
                if(!agreedToTos) return alert("規約への同意が必要です");
                const email = `${username}@chatia.app`;
                try {
                  const res = await createUserWithEmailAndPassword(auth, email, password);
                  await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false });
                  setPage("home");
                } catch { alert("登録エラー（既に使われている名前かパスワードが短すぎます）"); }
              }} className="btn-ani" style={{ ...btnStyle, width: "90%", background: "#000", color: "#fff", padding: "16px", borderRadius: "30px", fontWeight: "bold", fontSize: "16px" }}>同意して登録</button>
              
              <p style={{marginTop: "20px", fontSize: "14px", color: "#888"}} onClick={async () => {
                 const email = `${username}@chatia.app`;
                 try { await signInWithEmailAndPassword(auth, email, password); setPage("home"); } catch { alert("ログイン失敗"); }
              }}>登録済みの方はこちらでログイン</p>
            </div>
          )}
        </div>

        {/* ユーザー詳細モーダル */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "25px", textAlign: "center", width: "280px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon} style={{ width: "90px", height: "90px", borderRadius: "50%", border: "3px solid #f0f0f0" }} />
              <h3 style={{margin: "15px 0 5px"}}>{selectedUser.name}</h3>
              <p style={{color: "#999", fontSize: "13px", marginBottom: "20px"}}>@{selectedUser.displayId}</p>
              
              <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                {selectedUser.uid !== user.uid && (
                  <button onClick={() => addFriend(selectedUser)} style={{ ...btnStyle, background: "#f0f2f5", color: "#333", padding: "12px", borderRadius: "12px", width: "100%", fontWeight: "bold" }}>👤 フレンド追加</button>
                )}
                
                {user?.uid === ADMIN_UID && selectedUser.uid !== ADMIN_UID && (
                  <>
                    <button onClick={() => sendAdminNotification(selectedUser.uid)} style={{ ...btnStyle, background: "#ff9500", color: "#fff", padding: "12px", borderRadius: "12px", fontWeight: "bold" }}>✉️ 運営通知を送る</button>
                    <button onClick={() => { if(confirm("BANしますか？")) updateDoc(doc(db, "users", selectedUser.uid), {isBanned: true}); }} style={{ ...btnStyle, background: "red", color: "#fff", padding: "12px", borderRadius: "12px", fontWeight: "bold" }}>🚫 アカウントBAN</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 下部ナビゲーション */}
        {user && (
          <nav style={{ display: "flex", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", borderTop: "1px solid #f0f0f0", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", height: "70px", paddingBottom: "10px" }}>
            <button onClick={() => setPage("home")} className="btn-ani" style={{ ...btnStyle, flex: 1, background: "none", color: page === "home" ? "#000" : "#bbb", fontSize: "24px" }}>🏠</button>
            <button onClick={() => setPage("rooms")} className="btn-ani" style={{ ...btnStyle, flex: 1, background: "none", color: page === "rooms" || page === "chat" ? "#000" : "#bbb", fontSize: "24px" }}>💬</button>
            <button onClick={() => setPage("profile")} className="btn-ani" style={{ ...btnStyle, flex: 1, background: "none", color: page === "profile" ? "#000" : "#bbb", fontSize: "24px" }}>👤</button>
          </nav>
        )}

        {/* チャット入力バー */}
        {page === "chat" && (
          <div style={{ position: "fixed", bottom: "80px", width: "100%", maxWidth: "470px", background: "#fff", padding: "15px", margin: "0 15px", borderRadius: "25px", boxShadow: "0 -5px 20px rgba(0,0,0,0.05)", display: "flex", gap: "10px", alignItems: "center" }}>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: "15px", paddingTop: "8px" }} rows={1} />
            <button onClick={sendPost} className="btn-ani" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold" }}>送信</button>
          </div>
        )}
      </main>
    </div>
  );
}