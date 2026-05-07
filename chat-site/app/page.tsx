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

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [myData, setMyData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  
  const [page, setPage] = useState("home"); 
  const [text, setText] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) { setMyData(snap.data()); setEditName(snap.data().name); }
        });
        onSnapshot(query(collection(db, "notifications"), where("toUid", "==", u.uid)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, "friends"), where("users", "array-contains", u.uid)), (s) => setFriends(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });
    onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)), (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    return () => unsubAuth();
  }, []);

  const handleLike = async (p: any) => {
    const uid = user?.uid || "guest";
    const ref = doc(db, "posts", p.id);
    (p.likes || []).includes(uid) ? await updateDoc(ref, { likes: arrayRemove(uid) }) : await updateDoc(ref, { likes: arrayUnion(uid) });
  };

  const sendPost = async () => {
    if (!text.trim() && !postImage) return;
    setLoading(true);
    await addDoc(collection(db, "posts"), {
      text, image: postImage, senderUid: user?.uid || "guest", name: myData?.name || "ゲスト", icon: myData?.icon || DEFAULT_ICON, displayId: myData?.displayId || "guest", likes: [], createdAt: serverTimestamp()
    });
    setText(""); setPostImage(null); setLoading(false);
  };

  const navItem = (target: string, label: string) => (
    <button onClick={() => setPage(target)} style={{ flex: 1, padding: "15px", border: "none", background: "none", color: page === target ? "#000" : "#aaa", fontWeight: "bold", fontSize: "12px" }}>{label}</button>
  );

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", color: "#1c1e21" }}>
      <main style={{ width: "100%", maxWidth: "500px", margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        
        {/* ヘッダー */}
        <header style={{ padding: "10px 15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 100 }}>
          <b style={{ fontSize: "22px", letterSpacing: "-1px" }}>SNS App</b>
          <div style={{ display: "flex", gap: "10px" }}>
            {user && <button onClick={() => setPage("notify")} style={{ background: "none", border: "none", fontSize: "20px" }}>🔔</button>}
            {!user && <button onClick={() => setPage("auth")} style={{ background: "#000", color: "#fff", border: "none", padding: "6px 15px", borderRadius: "20px", fontSize: "12px" }}>ログイン/新規登録</button>}
          </div>
        </header>

        <div style={{ flex: 1, padding: "15px", paddingBottom: "100px" }}>
          
          {/* 1. ホーム画面 */}
          {page === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* チャットへようこそ */}
              <div style={{ textAlign: "center", padding: "40px 20px", background: "linear-gradient(135deg, #6e8efb, #a777e3)", borderRadius: "20px", color: "#fff" }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px" }}>チャットへようこそ！</h2>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  {user ? `${myData?.name || "ユーザー"}さん、今日も楽しみましょう！` : "ゲストさん、こんにちは！ログインすると全機能が使えます。"}
                </p>
              </div>

              {/* 運営通知 */}
              <div style={{ border: "1px solid #eee", borderRadius: "15px", padding: "20px", background: "#fff" }}>
                <b style={{ display: "block", marginBottom: "10px", fontSize: "16px" }}>📢 運営通知</b>
                <div style={{ fontSize: "13px", color: "#444", lineHeight: "1.6" }}>
                  <p>• 比率と権限のバグを修正しました。</p>
                  <p>• ログインするとフレンド機能やDM機能が解放されます。</p>
                </div>
              </div>

              {/* 利用規約の確認 */}
              <div style={{ border: "1px solid #eee", borderRadius: "15px", padding: "15px", background: "#f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>安心・安全な利用のために</span>
                <button onClick={() => setPage("terms")} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>利用規約を確認 →</button>
              </div>
            </div>
          )}

          {/* 2. チャット（タイムライン） */}
          {page === "global" && (
            <>
              <div style={{ border: "1px solid #eee", padding: "15px", borderRadius: "15px", marginBottom: "20px" }}>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="今なにしてる？" style={{ width: "100%", border: "none", outline: "none", fontSize: "16px", resize: "none" }} rows={2} />
                {postImage && <img src={postImage} style={{ width: "100%", borderRadius: "10px", aspectRatio: "16/9", objectFit: "cover", marginTop: "10px" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                  <label style={{ cursor: "pointer", fontSize: "20px" }}>🖼️<input type="file" style={{ display: "none" }} onChange={e => { const r = new FileReader(); r.onload = () => setPostImage(r.result as string); r.readAsDataURL(e.target.files![0]); }} /></label>
                  <button onClick={sendPost} style={{ background: "#000", color: "#fff", border: "none", padding: "8px 25px", borderRadius: "20px" }}>投稿</button>
                </div>
              </div>
              {posts.map(p => (
                <div key={p.id} style={{ display: "flex", gap: "12px", padding: "15px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <img 
                    src={p.icon || DEFAULT_ICON} 
                    style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #eee", cursor: "pointer" }} 
                    onClick={() => setSelectedUser(allUsers.find(u => u.uid === p.senderUid) || { name: p.name, icon: p.icon, displayId: p.displayId, uid: p.senderUid })} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b style={{ fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} <span style={{ fontWeight: "normal", color: "#999" }}>@{p.displayId}</span></b>
                      <span style={{ fontSize: "11px", color: "#ccc" }}>{p.createdAt?.toDate().toLocaleTimeString()}</span>
                    </div>
                    <p style={{ margin: "5px 0", fontSize: "15px", wordWrap: "break-word" }}>{p.text}</p>
                    {p.image && <img src={p.image} style={{ width: "100%", borderRadius: "10px", aspectRatio: "16/9", objectFit: "cover", marginTop: "8px" }} />}
                    <button onClick={() => handleLike(p)} style={{ background: "none", border: "none", marginTop: "8px", fontSize: "14px" }}>
                      {(p.likes || []).includes(user?.uid || "guest") ? "❤️" : "🤍"} {(p.likes || []).length}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 3. フレンド */}
          {page === "friends" && (
            <div>
              {!user ? <p style={{ textAlign: "center", marginTop: "50px" }}>ログインしてフレンドと繋がりましょう</p> : (
                <>
                  <h3>フレンド</h3>
                  {friends.map(f => {
                    const fId = f.users.find((id: string) => id !== user?.uid);
                    const info = allUsers.find(u => u.uid === fId);
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", borderBottom: "1px solid #eee" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img src={info?.icon || DEFAULT_ICON} width="40" height="40" style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          <b>{info?.name}</b>
                        </div>
                        <button style={{ background: "#eee", border: "none", padding: "5px 15px", borderRadius: "15px" }}>DM</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* 4. プロフィール編集 */}
          {page === "profile" && (
            <div style={{ textAlign: "center" }}>
              {!user ? <p>ログインが必要です</p> : (
                <>
                  <img src={myData?.icon || DEFAULT_ICON} style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover" }} />
                  <div style={{ margin: "20px 0" }}>
                    <label style={{ background: "#eee", padding: "10px 20px", borderRadius: "20px", cursor: "pointer" }}>アイコン変更<input type="file" style={{ display: "none" }} onChange={e => {
                      const r = new FileReader(); r.onload = () => updateDoc(doc(db, "users", user.uid), { icon: r.result as string }); r.readAsDataURL(e.target.files![0]);
                    }} /></label>
                  </div>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "90%", padding: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
                  <button onClick={() => updateDoc(doc(db, "users", user.uid), { name: editName })} style={{ width: "90%", marginTop: "15px", padding: "10px", background: "#000", color: "#fff", borderRadius: "10px" }}>保存</button>
                  <button onClick={() => signOut(auth)} style={{ color: "red", marginTop: "30px", display: "block", width: "100%" }}>ログアウト</button>
                </>
              )}
            </div>
          )}

          {/* 利用規約 (ドラフト版を適用) */}
          {page === "terms" && (
            <div style={{ fontSize: "12px", lineHeight: "1.8", color: "#444", padding: "10px" }}>
              <button 
                onClick={() => setPage("home")} 
                style={{ marginBottom: "15px", background: "#eee", border: "none", padding: "5px 15px", borderRadius: "5px", cursor: "pointer" }}
              >
                ← 戻る
              </button>
              
              <h3 style={{ textAlign: "center", marginBottom: "20px" }}>利用規約</h3>
              
              <div style={{ background: "#fff", padding: "15px", borderRadius: "10px", border: "1px solid #eee" }}>
                <p>本規約は、本サービス（以下、「本サービス」といいます）の利用条件を定めるものです。利用者の皆様には、本規約に従って本サービスをご利用いただきます。</p>

                <p><b>第1条（適用）</b><br />
                本規約は、利用者と本サービス運営者（以下、「運営者」といいます）との間の本サービスの利用に関わる一切の関係に適用されるものとします。</p>

                <p><b>第2条（禁止事項）</b><br />
                利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。<br />
                (1) 法令または公序良俗に違反する行為<br />
                (2) 犯罪行為に関連する行為<br />
                (3) 他の利用者、または第三者の知的財産権、プライバシー権、名誉権を侵害する行為<br />
                (4) サーバーまたはネットワークの機能を破壊・妨害する行為<br />
                (5) 本サービスの運営を妨げ、またはそのおそれのある行為<br />
                (6) 他の利用者に対する嫌がらせ、誹謗中傷、または卑猥な内容の投稿<br />
                (7) 宣伝、広告、勧誘、または営業活動を目的とする行為<br />
                (8) 面識のない異性との出会いを目的とした行為<br />
                (9) その他、運営者が不適切と判断する行為</p>

                <p><b>第3条（投稿内容の削除・利用停止）</b><br />
                運営者は、利用者が前条各号のいずれかに該当すると判断した場合、事前の通知なく、投稿内容の削除や本サービスの利用制限を行うことができるものとします。</p>

                <p><b>第4条（免責事項）</b><br />
                1. 運営者は、本サービスに起因して利用者に生じたあらゆる損害について、一切の責任を負いません。<br />
                2. 本サービスを通じて行われる利用者同士のやり取りやトラブルについて、運営者は一切関与せず、利用者が自己の責任で解決するものとします。<br />
                3. 運営者は、本サービスの提供の中断、停止、内容の変更、または廃止によって利用者に生じた損害について、一切の責任を負いません。</p>

                <p><b>第5条（著作権）</b><br />
                本サービスに投稿されたメッセージの著作権は投稿者に帰属しますが、運営者は本サービスの円滑な運営や保守のために、投稿内容を無償で複製・利用できるものとします。</p>

                <p><b>第6条（サービス内容の変更・終了）</b><br />
                運営者は、利用者に通知することなく、本サービスの内容を変更し、または本サービスの提供を中止することができるものとし、これによって利用者に生じた損害について一切の責任を負いません。</p>

                <p><b>第7条（利用規約の変更）</b><br />
                運営者は、必要と判断した場合には、利用者に通知することなくいつでも本規約を変更することができるものとします。変更後の規約は、本サービス上に表示された時点より効力を生じるものとします。</p>

                <p><b>第8条（準拠法・裁判管轄）</b><br />
                本規約の解釈にあたっては日本法を準拠法とし、本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する裁判所を専属的合意管轄とします。</p>
              </div>
            </div>
          )}

          {/* 認証 */}
          {page === "auth" && (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <input placeholder="メール" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "10px", border: "1px solid #ddd" }} />
              <button onClick={async () => {
                const res = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, name: "ユーザー", displayId: Math.random().toString(36).substring(7), icon: DEFAULT_ICON });
                setPage("home");
              }} style={{ width: "100%", background: "#000", color: "#fff", padding: "12px", borderRadius: "10px" }}>新規作成</button>
              <button onClick={async () => { await signInWithEmailAndPassword(auth, email, password); setPage("home"); }} style={{ width: "100%", marginTop: "10px", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }}>ログイン</button>
            </div>
          )}
        </div>

        {/* 下部ナビ */}
        <nav style={{ display: "flex", borderTop: "1px solid #eee", background: "#fff", position: "fixed", bottom: 0, width: "100%", maxWidth: "500px", zIndex: 100 }}>
          {navItem("home", "ホーム")}
          {navItem("global", "チャット")}
          {navItem("friends", "フレンド")}
          {navItem("profile", "プロフ")}
        </nav>

        {/* 個別プロフポップアップ */}
        {selectedUser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }} onClick={() => setSelectedUser(null)}>
            <div style={{ background: "#fff", padding: "30px", borderRadius: "25px", textAlign: "center", width: "300px" }} onClick={e => e.stopPropagation()}>
              <img src={selectedUser.icon || DEFAULT_ICON} style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover" }} />
              <h3 style={{ margin: "10px 0 5px" }}>{selectedUser.name}</h3>
              <p style={{ color: "#999", fontSize: "12px", marginBottom: "20px" }}>ID: @{selectedUser.displayId}</p>
              
              {!user ? (
                <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "15px" }}>
                  <p style={{ fontSize: "13px", color: "#666" }}>ログインすると、フレンド申請やDMを送ることができます。</p>
                  <button onClick={() => { setPage("auth"); setSelectedUser(null); }} style={{ marginTop: "10px", color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>ログインへ</button>
                </div>
              ) : selectedUser.uid !== user.uid ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button onClick={async () => {
                    await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: myData.name, toUid: selectedUser.uid, type: "friend_req", createdAt: serverTimestamp() });
                    alert("申請を送りました"); setSelectedUser(null);
                  }} style={{ background: "#000", color: "#fff", border: "none", padding: "12px", borderRadius: "15px", fontWeight: "bold" }}>フレンド申請</button>
                </div>
              ) : <p style={{ color: "#ccc" }}>あなた自身です</p>}
              <button onClick={() => setSelectedUser(null)} style={{ marginTop: "20px", color: "#999", background: "none", border: "none" }}>閉じる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}