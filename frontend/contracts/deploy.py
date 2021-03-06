from base64 import b64decode
from typing import Tuple
from algosdk.v2client.algod import AlgodClient
from algosdk import algod
from algosdk.future.transaction import *
from algosdk.atomic_transaction_composer import *
from algosdk.abi import *
from algosdk.kmd import KMDClient
from contract import get_approval_src, get_clear_src
import base64

KMD_ADDRESS = "http://localhost:4002"
KMD_TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
KMD_WALLET_NAME = "unencrypted-default-wallet"
KMD_WALLET_PASSWORD = ""


network = "mainnet"

ALGOD_ADDRESS = "http://localhost:4001"
ALGOD_TOKEN = "a" * 64

if network == "testnet":
    ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
    ALGOD_TOKEN = ""
elif network == "mainnet":
    ALGOD_ADDRESS = "https://mainnet-api.algonode.cloud"
    ALGOD_TOKEN = ""


testnet_client = AlgodClient(ALGOD_TOKEN, "https://testnet-api.algonode.cloud")

with open("abi.json") as f:
    interface = Interface.from_json(f.read())


def get_method(name: str) -> Method:
    for m in interface.methods:
        if m.name == name:
            return m
    raise Exception("No method with the name {}".format(name))


def deploy():
    client = AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

    accts = get_accounts()

    accts = get_accounts()
    addr = "MIAMI2UTQBFMGLX6PPTC456Q62NCPW5Q7SPVCXNMLKHKFNJWP5CBERUWZQ"

    for (acct, key) in accts:
        if acct == addr:
            sk = key

    signer = AccountTransactionSigner(sk)


    app_id, app_addr = create_app(
        testnet_client, client, addr, sk, get_approval=get_approval_src, get_clear=get_clear_src
    )
    print("Created App id: {} ({})".format(app_id, app_addr))

    sp = client.suggested_params()

    assets = [694816505, 694816506, 694816507]

    optin = get_method("optin")
    atc = AtomicTransactionComposer()
    for asset in assets:
        atc.add_method_call(app_id, optin, addr, sp, signer, [asset])
    atc.execute(client, 2)
    print("Opted in")

    atc = AtomicTransactionComposer()
    for asset in assets:
        atc.add_transaction(
            TransactionWithSigner(
                txn=AssetTransferTxn(addr, sp, app_addr, 80, asset),
                signer=signer,
            )
        )
    atc.execute(client, 2)
    print("Transferred")

    #print("Dropping")
    #raddr, rsk = accts[1]
    #rsigner = AccountTransactionSigner(rsk)
    #optin = get_method("drop")
    #atc = AtomicTransactionComposer()
    #for asset in assets:
    #    atc.add_transaction(
    #        TransactionWithSigner(
    #            txn=AssetTransferTxn(raddr, sp, raddr, 0, asset), signer=rsigner
    #        )
    #    )
    #    atc.add_method_call(app_id, optin, raddr, sp, rsigner, [asset])
    #atc.execute(client, 4)
    #print("Dropped")


def create_nft(client: algod.AlgodClient, addr: str, pk: str, name: str) -> int:
    sp = client.suggested_params()
    txn = AssetCreateTxn(addr, sp, 10000, 0, False, manager=addr, asset_name=name)
    txid = client.send_transaction(txn.sign(pk))
    result = wait_for_confirmation(client, txid, 2)
    return result["asset-index"]


def create_app(
    compile_client: algod.AlgodClient, client: algod.AlgodClient, addr: str, pk: str, get_approval, get_clear
) -> Tuple[int, str]:
    # Get suggested params from network
    sp = client.suggested_params()

    # Read in approval teal source && compile
    app_result = compile_client.compile(get_approval())
    app_bytes = base64.b64decode(app_result["result"])

    # Read in clear teal source && compile
    clear_result = compile_client.compile(get_clear())
    clear_bytes = base64.b64decode(clear_result["result"])

    # We dont need no stinkin storage
    schema = StateSchema(0, 0)

    # Create the transaction
    create_txn = ApplicationCreateTxn(
        addr,
        sp,
        0,
        app_bytes,
        clear_bytes,
        schema,
        schema,
    )

    # Sign it
    signed_txn = create_txn.sign(pk)

    # Ship it
    txid = client.send_transaction(signed_txn)

    # Wait for the result so we can return the app id
    result = wait_for_confirmation(client, txid, 2)

    app_id = result["application-index"]
    app_addr = logic.get_application_address(app_id)

    # Fund app addr
    pay_txn = PaymentTxn(addr, sp, app_addr, int(5e6))
    txid = client.send_transaction(pay_txn.sign(pk))
    wait_for_confirmation(client, txid, 2)

    return app_id, app_addr


def get_accounts():
    kmd = KMDClient(KMD_TOKEN, KMD_ADDRESS)
    wallets = kmd.list_wallets()

    walletID = None
    for wallet in wallets:
        if wallet["name"] == KMD_WALLET_NAME:
            walletID = wallet["id"]
            break

    if walletID is None:
        raise Exception("Wallet not found: {}".format(KMD_WALLET_NAME))

    walletHandle = kmd.init_wallet_handle(walletID, KMD_WALLET_PASSWORD)

    try:
        addresses = kmd.list_keys(walletHandle)
        privateKeys = [
            kmd.export_key(walletHandle, KMD_WALLET_PASSWORD, addr)
            for addr in addresses
        ]
        kmdAccounts = [(addresses[i], privateKeys[i]) for i in range(len(privateKeys))]
    finally:
        kmd.release_wallet_handle(walletHandle)

    return kmdAccounts


if __name__ == "__main__":
    deploy()
