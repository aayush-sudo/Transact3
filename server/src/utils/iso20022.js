/**
 * ISO 20022 Financial Messaging Engine for Institutional Cross-Border Settlement
 */

class ISO20022Engine {
  /**
   * pacs.008.001.08: Financial Institutional Customer Credit Transfer
   */
  generatePacs008(transaction) {
    const msgId = `MSG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const endToEndId = `E2E-${transaction._id || transaction.quoteId || Date.now()}`;
    const creationTime = new Date().toISOString();

    return {
      messageType: 'pacs.008.001.08',
      standard: 'ISO 20022 Universal Financial Industry Message Scheme',
      GroupHeader: {
        MessageIdentification: msgId,
        CreationDateTime: creationTime,
        NumberOfTransactions: '1',
        SettlementInformation: {
          SettlementMethod: 'CLRG',
          ClearingSystem: {
            Proprietary: transaction.selectedRail || 'SWIFT_BATCH'
          }
        },
        InstructingAgent: {
          FinancialInstitutionIdentification: {
            BICFI: 'TR3SUS33XXX',
            Name: 'Transact3 Meta-Router Hub'
          }
        },
        InstructedAgent: {
          FinancialInstitutionIdentification: {
            BICFI: transaction.selectedRail === 'SWIFT_BATCH' ? 'SWIFTINTL' : 'LOCALCLRXXX',
            Name: `${transaction.selectedRail} Settlement Gateway`
          }
        }
      },
      CreditTransferTransactionInformation: {
        PaymentIdentification: {
          InstructionIdentification: `INSTR-${msgId}`,
          EndToEndIdentification: endToEndId,
          TransactionIdentification: `TXID-${transaction.clearingReference || transaction._id || Date.now()}`
        },
        InterbankSettlementAmount: {
          currency: transaction.sourceCurrency || 'USD',
          amount: transaction.sourceAmount
        },
        InstructedAmount: {
          currency: transaction.destinationCurrency || 'EUR',
          amount: transaction.destinationAmount
        },
        ExchangeRateInformation: {
          UnitCurrency: transaction.sourceCurrency || 'USD',
          ExchangeRate: transaction.quotedFXRate || transaction.referenceFXRate || 1.0,
          ContractIdentification: transaction.quoteId || 'SPOT'
        },
        ChargeBearer: 'DEBT',
        Debtor: {
          Name: 'Corporate Treasury Client',
          Account: {
            Identification: {
              IBAN: `US99TR3S000000${transaction.sender || '12345678'}`
            }
          }
        },
        Creditor: {
          Name: transaction.receiverEmail || 'Supplier Beneficiary',
          Account: {
            Identification: {
              Proprietary: transaction.receiverEmail || 'BENEFICIARY_VAULT'
            }
          }
        },
        RemittanceInformation: {
          Unstructured: `Transact3 AI Multi-Rail Optimized Settlement: ${transaction.selectedRail || 'DEFAULT'}`
        }
      }
    };
  }

  /**
   * camt.053.001.08: Bank-to-Customer Statement
   */
  generateCamt053(transaction, ledgerEntries) {
    const stmtId = `STMT-${Date.now().toString(36).toUpperCase()}`;
    return {
      messageType: 'camt.053.001.08',
      Statement: {
        Identification: stmtId,
        CreationDateTime: new Date().toISOString(),
        ElectronicSequenceNumber: 1,
        Account: {
          Identification: { IBAN: 'TR3S-GLOBAL-CLEARING' },
          Currency: transaction.sourceCurrency || 'USD'
        },
        Balance: {
          Type: 'CLBD',
          Amount: { currency: transaction.sourceCurrency, amount: transaction.sourceAmount },
          CreditDebitIndicator: 'CRDT',
          Date: new Date().toISOString().split('T')[0]
        },
        Entries: (ledgerEntries || []).map((e, idx) => ({
          EntryReference: `ENT-${idx}`,
          Amount: { currency: e.currency, amount: e.amount },
          CreditDebitIndicator: e.entryType === 'DEBIT' ? 'DBIT' : 'CRDT',
          Status: 'BOOK',
          BookingDate: new Date().toISOString(),
          AccountDetails: e.accountName,
          Description: e.description
        }))
      }
    };
  }

  /**
   * pacs.002.001.10: Payment Status Report
   */
  generatePacs002(transaction, status = 'ACTC') {
    return {
      messageType: 'pacs.002.001.10',
      GroupHeader: {
        MessageIdentification: `STAT-${Date.now().toString(36).toUpperCase()}`,
        CreationDateTime: new Date().toISOString()
      },
      OriginalGroupInformationAndStatus: {
        OriginalMessageIdentification: `MSG-${transaction.quoteId}`,
        OriginalMessageNameIdentification: 'pacs.008.001.08',
        GroupStatus: status,
        StatusReasonInformation: {
          Reason: {
            Code: 'G000',
            AdditionalInformation: `Settled successfully via Transact3 ${transaction.selectedRail || 'RAIL'}`
          }
        }
      }
    };
  }

  /**
   * pacs.008.001.10: Financial Institutional Customer Credit Transfer (XML Output)
   */
  generatePacs008Xml(transaction) {
    const msgId = `MSG${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const endToEndId = `E2E-TX-${transaction._id || transaction.quoteId || Date.now()}`;
    const uetr = transaction.clearingReference || `UETR-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
    const creationTime = new Date().toISOString();
    const sourceAmt = Number(transaction.sourceAmount || 0).toFixed(2);
    const destAmt = Number(transaction.destinationAmount || 0).toFixed(2);
    const rate = Number(transaction.quotedFXRate || transaction.referenceFXRate || 1.0).toFixed(4);
    const rail = transaction.selectedRail || 'REGIONAL_INSTANT';
    const receiver = transaction.receiverEmail || 'Recipient';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creationTime}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
        <ClrSys>
          <Prtry>${rail}</Prtry>
        </ClrSys>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>${endToEndId}</EndToEndId>
        <UETR>${uetr}</UETR>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${transaction.sourceCurrency || 'USD'}">${sourceAmt}</IntrBkSttlmAmt>
      <InstdAmt Ccy="${transaction.destinationCurrency || 'EUR'}">${destAmt}</InstdAmt>
      <XchgRateInf>
        <XchgRate>${rate}</XchgRate>
      </XchgRateInf>
      <Dbtr>
        <Nm>Transact3 Client Account</Nm>
      </Dbtr>
      <Cdtr>
        <Nm>${receiver}</Nm>
      </Cdtr>
      <RmtInf>
        <Ustrd>Transact3 Intelligent Multi-Rail Settlement: ${rail}</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`.trim();
  }
}

module.exports = new ISO20022Engine();
