import React from 'react';
import { config, getAirdropTxns, sendWait, countRemaining } from './lib/algorand'
import WalletSession from "./lib/wallet_session"
import { AnchorButton, Dialog, Card, Button, Elevation, Classes } from "@blueprintjs/core"
import { MobileView, isIOS } from 'react-device-detect'
import {MediaDisplay} from './MediaDisplay'
import { NFT } from './lib/nft';

import wave from './images/wave.png';
import presents from './images/presents.png';
import logo from './images/logo.png';
import c240 from './images/c240.png';
import connectbtn from './images/connectbtn.png';
import claimbtn from './images/claimbtn.png';
import logo_white from './images/logo_white.png';
import artbox from './images/artbox.png';
import line from './images/line.png';

function App() {

  const [loading, setLoading] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [wallet, setWallet] = React.useState(new WalletSession(config.algod.network))
  const [connected, setConnected] = React.useState(false)
  const [remaining, setRemaining] = React.useState(0)
  const [asset_id, setAssetId] = React.useState<number>(0)
  const [nft, setNFT] = React.useState<NFT|undefined>(undefined)

  // This is the hack that makes iOS not kill our websocket with WalletConnect
  const audio_ref = React.useRef<HTMLAudioElement>(document.getElementById('hack') as HTMLAudioElement);

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash
    const aid = hash === "" ? 0 : parseInt(hash.split("#")[1])
    setAssetId(isNaN(aid) ? 0 : aid);
  })


  const hash = window.location.hash
  const aid = hash === "" ? 0 : parseInt(hash.split("#")[1])


  React.useEffect(() => { setConnected(wallet.isConnected()) }, [wallet])
  React.useEffect(() => {

    if(aid !== 0 && ! isNaN(aid)){
      setAssetId(aid);
    }

    if (asset_id === 0) return;

    NFT.fromAssetId(asset_id).then((nft)=>{
      setNFT(nft)
    })

    countRemaining(asset_id).then((cnt: number) => {
      setRemaining(cnt)
    })

  }, [loading, asset_id])


  // If no asset id in path, just dump links
  if (asset_id === 0) {
    const links = config.assets.map((aidx)=>{
        return <a key={aidx} href={'#' + aidx.toString()}>{aidx}</a>
    })

    return (
      <div className='container'>
        {links}
      </div>
    )
  }

  async function triggerDrop(asset_id: number) {
    audio_ref.current?.play()
    setLoading(true)

    const txns = await getAirdropTxns(asset_id, wallet.getDefaultAccount())
    const signed = await wallet.signTxn(txns)
    await sendWait(signed.map((stxn) => { return stxn.blob }))

    setLoading(false)
    audio_ref.current?.pause()
  }

  async function connect() {
    audio_ref.current?.play()
    wallet.connect(() => {
      setConnected(true)
      audio_ref.current?.pause()
    })
  }

  // const display = nft === undefined ? <></>: <MediaDisplay
  //   mediaSrc={nft.mediaURL()}
  //   mimeType={nft.metadata.mimeType()}
  // />

  let asset_name = nft=== undefined? asset_id.toString():nft.name()
  if(asset_name === ""){
    asset_name = "tbd asset name"
  }


  const content = connected ? (
    <div style={{padding: '1rem 2rem', position: 'relative'}}>
      <img style={{padding: '0'}} src={logo} />
      <img style={{padding: '2rem 0 0.25rem 0'}} src={presents} />
      <div className='content' style={{display: 'block'}}>
        {/* {display} */}
        <img src={artbox} />
        <img style={{paddingTop: '0.5rem'}} src={c240} />
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0 0.5rem 0'}}>
          <img style={{width: '50%', paddingRight: '1rem'}} src={line} />
          <p style={{color: 'white', margin: 0}}>{remaining} PIECES REMAINING</p>
        </div>
        <Button className='clear_button' style={{padding: '1rem 0'}}
          intent='success'
          onClick={() => { triggerDrop(asset_id) }}
          loading={loading}
        ><img src={claimbtn} /></Button>
      </div>
      <div style={{bottom: 0, left: 0, right: 0, position: 'absolute', padding: '2rem'}}>
        <img style={{bottom: '0'}} src={wave} />
      </div>
    </div>
  ) : (
    <div style={{padding: '1rem 2rem', position: 'relative'}}>

      <img style={{padding: '0'}} src={logo} />
      <img style={{padding: '2rem 0 0.5rem 0'}} src={presents} />
      <img style={{margin: '0 auto'}} src={c240} />
      <img style={{padding: '3rem'}} src={logo_white} />
      <Button className='clear_button' style={{paddingTop: '1rem'}} onClick={connect}><img src={connectbtn} /></Button>
      <div style={{bottom: 0, left: 0, right: 0, position: 'absolute', padding: '2rem'}}>
        <img style={{bottom: '0'}} src={wave} />
      </div>
    </div>
  )

  return (
    <div className="container">
      <div className='content'>
        {content}
      </div>
      <audio hidden id='hack' ref={audio_ref} src='https://github.com/anars/blank-audio/blob/master/30-seconds-of-silence.mp3?raw=true' ></audio>
      <PromptAppNav isOpen={loading} />
    </div>
  );
}

interface PromptAppNavProps {
  isOpen: boolean
}
function PromptAppNav(props: PromptAppNavProps) {
  return (
    <Dialog {...props} >
      <div className={Classes.DIALOG_BODY}>
        <div className='container'>
          <div className='content'>
            <p>Open the Pera Wallet to approve the transaction then come back</p>
          </div>
          <MobileView>
            <AnchorButton
              style={{ borderRadius: '8px', margin: '20px 0px -30px' }}
              text='Take me there'
              href={isIOS ? "algorand-wc://wc?uri=wc:00e46b69-d0cc-4b3e-b6a2-cee442f97188@1" : "wc:00e46b69-d0cc-4b3e-b6a2-cee442f97188@1"}
              intent="success"
              large={true}
              minimal={true}
              outlined={true}
              rightIcon="double-chevron-right"
            />
          </MobileView>
        </div>
      </div>
    </Dialog>
  )
}

export default App;