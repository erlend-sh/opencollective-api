import Promise from 'bluebird';
import activities from '../constants/activities';

/*
 * Transaction model
 * - this indicates that money was moved in the system
 */

export default (Sequelize, DataTypes) => {

  const { models } = Sequelize;

  const Transaction = Sequelize.define('Transaction', {
    type: DataTypes.STRING, // Expense or Donation
    description: DataTypes.STRING,
    amount: DataTypes.INTEGER,
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
      set(val) {
        if (val && val.toUpperCase) {
          this.setDataValue('currency', val.toUpperCase());
        }
      }
    },

    // stores the currency that the transaction happened in (currency of the host)
    txnCurrency: {
      type: DataTypes.STRING,
      set(val) {
        if (val && val.toUpperCase) {
          this.setDataValue('txnCurrency', val.toUpperCase());
        }
      }
    },

    // stores the foreign exchange rate at the time of transaction between donation currency and transaction currency
    // txnCurrencyFxRate = amount/amountInTxnCurrency
    txnCurrencyFxRate: DataTypes.FLOAT,

    // amount in currency of the host
    amountInTxnCurrency: DataTypes.INTEGER,
    platformFeeInTxnCurrency: DataTypes.INTEGER,
    hostFeeInTxnCurrency: DataTypes.INTEGER,
    paymentProcessorFeeInTxnCurrency: DataTypes.INTEGER,
    netAmountInGroupCurrency: DataTypes.INTEGER, // stores the net amount received by the group

    data: DataTypes.JSON,

    createdAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW
    },

    deletedAt: {
      type: DataTypes.DATE
    }
  }, {
    paranoid: true,

    getterMethods: {

      isDonation() {
        return this.amount > 0;
      },

      isExpense() {
        return this.amount < 0;
      },

      // Info.
      info() {
        return {
          id: this.id,
          type: this.type,
          description: this.description,
          amount: this.amount,
          currency: this.currency,
          createdAt: this.createdAt,
          UserId: this.UserId,
          GroupId: this.GroupId,
          isExpense: this.isExpense,
          isDonation: this.isDonation,
          platformFee: this.platformFee,
          hostFee: this.hostFee,
          paymentProcessorFee: this.paymentProcessorFee,
          netAmountInGroupCurrency: this.netAmountInGroupCurrency
        };
      }
    },

    instanceMethods: {
      getHost() {
        return models.User.findOne({
          include: [
            { model: models.UserGroup, where: { role: 'HOST', GroupId: this.GroupId } }
          ]
        });
      }
    },

    classMethods: {

      createMany: (transactions, defaultValues) => {
        return Promise.map(transactions, transaction => {
          for (const attr in defaultValues) {
            transaction[attr] = defaultValues[attr];
          }
          return Transaction.create(transaction);
        }).catch(console.error);
      },

      createFromPayload({ transaction, user, group, paymentMethod }) {

        // attach other objects manually. Needed for afterCreate hook to work properly
        transaction.UserId = user && user.id;
        transaction.GroupId = group && group.id;
        transaction.PaymentMethodId = transaction.PaymentMethodId || (paymentMethod ? paymentMethod.id : null);

        if (transaction.amount > 0 && transaction.txnCurrencyFxRate) {
          // populate netAmountInGroupCurrency for donations
            transaction.netAmountInGroupCurrency =
              Math.round((transaction.amountInTxnCurrency
                - transaction.platformFeeInTxnCurrency
                - transaction.hostFeeInTxnCurrency
                - transaction.paymentProcessorFeeInTxnCurrency)
              *transaction.txnCurrencyFxRate);
        } else {
          // populate netAmountInGroupCurrency for "Add Funds" and Expenses
          transaction.netAmountInGroupCurrency = transaction.amount;
          // set the currency to be group's currency, if not specified
          transaction.currency = transaction.currency || group.currency;
        }
        return Transaction.create(transaction);
      },

      createActivity(transaction) {
        if (transaction.deletedAt) {
          return Promise.resolve();
        }
        return Transaction.findById(transaction.id, {
          include: [
            { model: Sequelize.models.Group },
            { model: Sequelize.models.User },
            { model: Sequelize.models.PaymentMethod }
          ]
        })
        // Create activity.
        .then(transaction => {

          const activityPayload = {
            type: activities.GROUP_TRANSACTION_CREATED,
            TransactionId: transaction.id,
            GroupId: transaction.GroupId,
            UserId: transaction.UserId,
            data: {
              transaction: transaction.get(),
              user: transaction.User && transaction.User.minimal,
              group: transaction.Group && transaction.Group.minimal
            }
          };
          if (transaction.User) {
            activityPayload.data.user = transaction.User.info;
          }
          if (transaction.PaymentMethod) {
            activityPayload.data.paymentMethod = transaction.PaymentMethod.info;
          }
          return Sequelize.models.Activity.create(activityPayload);
        })
        .catch(err => console.error(`Error creating activity of type ${activities.GROUP_TRANSACTION_CREATED} for transaction ID ${transaction.id}`, err));
      }
    },

    hooks: {
      afterCreate: (transaction) => {
        return Transaction.createActivity(transaction);
      }
    }
  });

  return Transaction;
};
