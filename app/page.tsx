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

// ★【重要】自分のUIDをここに貼り付けてください（管理者になります）
const ADMIN_UID = "YOUR_ACTUAL_UID_HERE"; 

const ROOMS = [
  { id: "general1", name: "雑談1" }, { id: "general2", name: "雑談2" }, { id: "general3", name: "雑談3" },
  { id: "game1", name: "ゲーム1" }, { id: "game2", name: "ゲーム2" }, { id: "game3", name: "ゲーム3" },
  { id: "art1", name: "お絵描き1" }, { id: "art2", name: "お絵描き2" }, { id: "art3", name: "お絵描き3" },
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [activeRoom, setActiveRoom] = useState("general1");
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
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
            // BANチェック：ログイン時に追い出す
            if (data.isBanned) { alert("このアカウントは凍結されています。"); signOut(auth); return; }
            setMyData(data); 
            setEditName(data.name); 
          }
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, "friends"), where("users", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      } else { setMyData(null); }
    });
    // 全ユーザー監視（管理パネル用）
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "posts"), where("room", "==", activeRoom), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (s) => {
      setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      const simpleQ = query(collection(db, "posts"), where("room", "==", activeRoom), limit(50));
      onSnapshot(simpleQ, (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    });
    return () => unsub();
  }, [activeRoom]);

  const handleAuth = async (type: "signup" | "login") => {
    if (!username || !password) return alert("名前とパスワードを入力してください");
    const email = `${encodeURIComponent(username)}@chatia.app`;
    try {
      if (type === "signup") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid, name: username, displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON, isBanned: false
        });
      } else { await signInWithEmailAndPassword(auth, email, password); }
      setPage("home"); setUsername(""); setPassword("");
    } catch (e) { alert("ログイン失敗: 名前かパスワードが違います"); }
  };

  const sendPost = async () => {
    if (!text.trim() && !postImage) return;
    await addDoc(collection(db, "posts"), {
      text, image: postImage, room: activeRoom,
      senderUid: user?.uid || "guest", name: myData?.name || "ゲスト", icon: myData?.icon || DEFAULT_ICON, 
      displayId: myData?.displayId || "guest", likes: [], createdAt: serverTimestamp()
    });
    setText(""); setPostImage(null);
  };

  // 通報機能
  const reportPost = async (p: any) => {
    if (!confirm("不適切な投稿として通報しますか？")) return;
    await addDoc(collection(db, "reports"), {
      postId: p.id, postText: p.text, targetUid: p.senderUid, targetName: p.name,
      reporterUid: user?.uid || "guest", createdAt: serverTimestamp()
    });
    alert("通報を送信しました。運営が確認します。");
  };

  const btnStyle: React.CSSProperties = { cursor: "pointer", transition: "transform 0.1s ease", border: "none", outline: "none" };

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", color: "#1a1a1a" }}>
      <style>{`.btn-active:active { transform: scale(0.96); opacity: 0.8; } .no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 20px rgba(0,0,0,0.05)" }}>
        
        <header style={{ padding: "15px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 100 }}>
          <b style={{ fontSize: "22px", fontWeight: "900" }}>Chatia</b>
          {user && (
            <button onClick={() => setPage("notify")} className="btn-active" style={{ ...btnStyle, background: "none", fontSize: "20px", position: "relative" }}>
              🔔 {notifications.length > 0 && <span style={{ position: "absolute", top: 0, right: 0, background: "red", borderRadius: "50%", width: "8px", height: "8px" }} />}
            </button>
          )}
        </header>

        <div style={{ flex: 1, padding: "20px", paddingBottom: "100px" }}>
          
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ textAlign: "center", padding: "50px 20px", background: "#000", borderRadius: "20px", color: "#fff" }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>Chatia</h2>
                <p style={{ fontSize: "14px", opacity: 0.8 }}>{user ? `${myData?.name}さん、こんにちは！` : "ゲストさん、こんにちは！"}</p>
              </div>

              {/* 管理者用：ユーザー管理ボタン */}
              {user?.uid === ADMIN_UID && (
                <button onClick={() => setPage("admin")} className="btn-active" style={{ ...btnStyle, background: "#ff4d4f", color: "#fff", padding: "15px", borderRadius: "15px", fontWeight: "bold" }}>🛡 ユーザー管理パネル</button>
              )}

              <div style={{ border: "1px solid #eee", borderRadius: "15px", padding: "20px" }}>
                <b>運営からのお知らせ</b>
                <p style={{ fontSize: "13px", color: "#666", marginTop: "10px" }}>・通報機能を追加しました。<br/>・管理者が悪質なユーザーをBANできるようになりました。</p>
              </div>
              <button onClick={() => setPage("terms")} className="btn-active" style={{ ...btnStyle, background: "#f5f5f5", padding: "15px", borderRadius: "15px", fontSize: "14px", textAlign: "left" }}>📄 利用規約を確認する</button>
            </div>
          )}

          {page === "global" && (
            <>
              <div className="no-scrollbar" style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "20px" }}>
                {ROOMS.map(r => (
                  <button key={r.id} onClick={() => setActiveRoom(r.id)} className="btn-active" style={{ ...btnStyle, whiteSpace: "nowrap", padding: "10px 18px", borderRadius: "10px", fontSize: "13px", background: activeRoom === r.id ? "#000" : "#f5f5f5", color: activeRoom === r.id ? "#fff" : "#666" }}>{r.name}</button>
                ))}
              </div>
              <div style={{ border: "1px solid #eee", padding: "15px", borderRadius: "15px", marginBottom: "25px" }}>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder={`${ROOMS.find(r => r.id === activeRoom)?.name}に投稿...`} style={{ width: "100%", border: "none", outline: "none", fontSize: "16px", resize: "none" }} rows={2} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <label className="btn-active" style={{ ...btnStyle, fontSize: "13px", color: "#666" }}>画像<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]); }} /></label>
                  <button onClick={sendPost} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "8px 25px", borderRadius: "20px", fontWeight: "bold" }}>投稿</button>
                </div>
              </div>
              {posts.map(p => (
                <div key={p.id} style={{ display: "flex", gap: "12px", padding: "15px 0", borderBottom: "1px solid #f9f9f9", position: "relative" }}>
                  <img src={p.icon || DEFAULT_ICON} className="btn-active" style={{ ...btnStyle, width: "45px", height: "45px", borderRadius: "12px", objectFit: "cover" }} onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid) || { name: p.name, icon: p.icon, displayId: p.displayId, uid: p.senderUid })} />
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: "14px" }}>{p.name} <span style={{ fontWeight: "normal", color: "#999" }}>@{p.displayId}</span></b>
                    <p style={{ margin: "5px 0", fontSize: "15px" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", marginTop: "8px" }} />}
                    <div style={{ display: "flex", gap: "15px", alignItems: "center", marginTop: "5px" }}>
                      <button onClick={() => updateDoc(doc(db, "posts", p.id), { likes: (p.likes || []).includes(user?.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) })} style={{ ...btnStyle, background: "none", fontSize: "14px" }}>{(p.likes || []).includes(user?.uid) ? "❤️" : "🤍"} {(p.likes || []).length}</button>
                      <button onClick={() => reportPost(p)} style={{ background: "none", border: "none", fontSize: "12px", color: "#ccc", cursor: "pointer" }}>🚩 通報</button>
                    </div>
                  </div>
                  {/* 管理者用：投稿削除ボタン */}
                  {user?.uid === ADMIN_UID && (
                    <button onClick={() => confirm("削除しますか？") && deleteDoc(doc(db, "posts", p.id))} style={{ color: "#ff4d4f", background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
                  )}
                </div>
              ))}
            </>
          )}

          {page === "admin" && (
            <div>
              <button onClick={() => setPage("home")} style={{ marginBottom: "20px", background: "#f5f5f5", border: "none", padding: "5px 15px", borderRadius: "8px" }}>← 戻る</button>
              <h3>ユーザー管理（BAN）</h3>
              <div style={{ marginTop: "20px" }}>
                {allUsers.map(u => (
                  <div key={u.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", borderBottom: "1px solid #eee", background: u.isBanned ? "#fff1f0" : "none" }}>
                    <div>
                      <b style={{ fontSize: "14px" }}>{u.name}</b>
                      <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>ID: {u.displayId} / UID: {u.uid.substring(0, 8)}...</p>
                    </div>
                    {u.uid !== ADMIN_UID && (
                      <button onClick={() => confirm(`${u.name}のBAN状態を切り替えますか？`) && updateDoc(doc(db, "users", u.uid), { isBanned: !u.isBanned })} className="btn-active" style={{ ...btnStyle, background: u.isBanned ? "#52c41a" : "#ff4d4f", color: "#fff", padding: "6px 15px", borderRadius: "10px", fontSize: "12px" }}>
                        {u.isBanned ? "解除" : "BANする"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ... フレンド, 通知, プロフ, 規約, 認証 ページは元のコード通り ... */}
          {page === "friends" && ( <div><h3>フレンドリスト</h3>{/* 以下、元のロジック */}</div> )}
          {page === "profile" && ( <div style={{ paddingTop: "20px" }}>{user ? (<> <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "40px" }}><img src={myData?.icon || DEFAULT_ICON} style={{ width: "80px", height: "80px", borderRadius: "20px", objectFit: "cover" }} /><div><h3 style={{ margin: 0 }}>{myData?.name}</h3><p style={{ color: "#999", margin: 0 }}>@{myData?.displayId}</p></div></div><div style={{ display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ display: "flex", gap: "10px" }}><label className="btn-active" style={{ ...btnStyle, flex: 1, background: "#f5f5f5", padding: "12px", borderRadius: "12px", textAlign: "center" }}>アイコン変更<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string }); r.readAsDataURL(e.target.files![0]); }} /></label><button onClick={() => updateDoc(doc(db, "users", user.uid), { icon: DEFAULT_ICON })} className="btn-active" style={{ ...btnStyle, border: "1px solid #eee", color: "red", padding: "12px", borderRadius: "12px" }}>削除</button></div><input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "1px solid #f0f0f0" }} /><button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "15px", borderRadius: "12px", fontWeight: "bold" }}>設定を保存</button><button onClick={() => signOut(auth)} className="btn-active" style={{ ...btnStyle, color: "#999", marginTop: "20px", background: "none" }}>ログアウト</button></div></>) : <p>ログインが必要です</p>}</div> )}
          {page === "notify" && ( <div><h3>通知</h3>{/* 以下、元のロジック */}</div> )}
          {page === "terms" && ( <div><button onClick={() => setPage("home")} style={{ marginBottom: "20px", background: "#f5f5f5", border: "none", padding: "5px 15px", borderRadius: "8px" }}>戻る</button><h3>利用規約</h3><p style={{ fontSize: "14px", color: "#666" }}>1. 他人への誹謗中傷を禁止します。<br/>2. 不適切な画像の投稿を禁止します。<br/>3. 楽しく使いましょう。</p></div> )}
          {page === "auth" && ( <div style={{ textAlign: "center", padding: "40px 10px" }}><h2 style={{ marginBottom: "30px" }}>Chatia</h2><input placeholder="名前" value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "10px", borderRadius: "12px", border: "1px solid #ddd" }} /><input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "15px", marginBottom: "20px", borderRadius: "12px", border: "1px solid #ddd" }} /><button onClick={() => handleAuth("signup")} className="btn-active" style={{ ...btnStyle, width: "100%", background: "#000", color: "#fff", padding: "15px", borderRadius: "12px", fontWeight: "bold" }}>新規登録</button><button onClick={() => handleAuth("login")} className="btn-active" style={{ ...btnStyle, width: "100%", marginTop: "10px", padding: "15px", borderRadius: "12px", border: "1px solid #ddd" }}>ログイン</button></div> )}

        </div>

        <nav style={{ display: "flex", borderTop: "1px solid #f0f0f0", background: "#fff", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", zIndex: 100 }}>
          <button onClick={() => setPage("home")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "home" ? "#000" : "#bbb", fontSize: "11px", fontWeight: "bold" }}>ホーム</button>
          <button onClick={() => setPage("global")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "global" ? "#000" : "#bbb", fontSize: "11px", fontWeight: "bold" }}>チャット</button>
          <button onClick={() => setPage("friends")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "friends" ? "#000" : "#bbb", fontSize: "11px", fontWeight: "bold" }}>フレンド</button>
          <button onClick={() => setPage("profile")} className="btn-active" style={{ ...btnStyle, flex: 1, padding: "15px", color: page === "profile" ? "#000" : "#bbb", fontSize: "11px", fontWeight: "bold" }}>プロフ</button>
        </nav>

        {/* ユーザー詳細モーダル（そのまま） */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "25px", textAlign: "center", width: "320px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon || DEFAULT_ICON} style={{ width: "80px", height: "80px", borderRadius: "20px", objectFit: "cover" }} />
              <h3>{selectedUser.name}</h3>
              <p style={{ color: "#999", marginBottom: "20px" }}>@{selectedUser.displayId}</p>
              {user && selectedUser.uid !== user.uid && (
                <button onClick={async () => {
                  await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: myData.name, toUid: selectedUser.uid, type: "friend_req", createdAt: serverTimestamp() });
                  alert("申請を送りました"); setSelectedUser(null);
                }} className="btn-active" style={{ ...btnStyle, background: "#000", color: "#fff", padding: "12px", width: "100%", borderRadius: "15px" }}>フレンド申請</button>
              )}
              <button onClick={() => setSelectedUser(null)} style={{ marginTop: "20px", color: "#999", background: "none", border: "none" }}>閉じる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}