import type { CurOrmStoreType, CurOperType, MyObject, OrderByType, WhereConnectType, WhereType, DataType, TableFieldsOption } from "types";
/** 构建 update when 配置 */
export type BuildUpdateByWhenOption<T = any> = {
    /** 操作的数据 */
    datas: T[];
    /** 一次最大更新多少条数据 */
    onceMaxUpdateDataLength?: number;
    /** 字段数据 */
    fieldOpts: {
        /** SET xxx 里的 xxx 字段 */
        setField: string;
        /** WHEN xxx=yyy 里的 xxx 数据 */
        getWhenField: (row: T) => string | number;
        /** WHEN xxx=yyy 里的 yyy 数据 */
        getWhenValue: (row: T) => string | number;
        /** THEN xxx=yyy 里的 yyy 数据 */
        getThenValue: (row: T) => string | number;
    }[];
    /** 额外的 updateWhen 子句 */
    getExtraUpdateWhen?: (updates: T[]) => string;
    /** 额外的 where 子句 */
    getExtraWhere?: (updates: T[]) => string;
};
/**
 * SQLite ORM
 */
declare class SqliteOrm {
    private tableName;
    private curOrmStore;
    constructor(tableName: string);
    /** 获取默认的ORM方法 */
    static getDefaultCurOrmStore(): CurOrmStoreType;
    /** 获取表名称 */
    getTableName(): string;
    /** 修改表名称 */
    setTableName(tableName: string): this;
    /** 清除ORM状态 */
    private clearCurOrmStore;
    /**
     * 清除状态
     */
    clear(): this;
    /** 设置操作状态 */
    setOperStore<T extends CurOperType>(key: T, value: CurOrmStoreType[T]): this;
    /**
     * 生成 INSERT 语句
     * @param data 插入的数据
     * @returns `string`
     */
    inser<T extends MyObject>(data: T): string;
    /**
     * 批量生成 INSERT 语句
     * @param datas 插入的数据
     * @param maxSize 因为 sqlite 存在限制, 一次sql最多只能插入999个变量的值, 这里参数进行控制
     * @returns `string[]`
     */
    insers<T extends MyObject[]>(datas: T, maxSize?: number): string[] | "";
    delect(): this;
    update<T extends MyObject>(obj: T): this;
    select(field?: string): this;
    count(field: string): this;
    groupBy(field: string): this;
    orderBy(order: OrderByType, field: string): this;
    private buildWhereItem;
    /** 设置 WHERE */
    where(key: string, connect: WhereConnectType, value: any): this;
    /** 设置 AND */
    and(key: string, connect: WhereConnectType, value: any): this;
    /** 设置 OR */
    or(key: string, connect: WhereConnectType, value: any): this;
    private buildWhereArrayItem;
    /** 批量设置 WHERE */
    whereArray(key: string, connect: WhereConnectType, value: any[], whereType: WhereType): this;
    /** 批量设置 WHERE OR */
    orArray(key: string, connect: WhereConnectType, value: any[]): this;
    /** 批量设置 WHERE AND */
    andArray(key: string, connect: WhereConnectType, value: any[]): this;
    /** 设置 LIMIT */
    limit(limit: number, offset: number): this;
    /** 获取原始sql语句 */
    getSqlRaw(): string;
    /** 生成 WHERE */
    private buildWhere;
    /** 生成 GROUP BY */
    private buildGroupBy;
    /** 生成 ORDER BY */
    private buildOrderBy;
    /** 生成 LIMIT */
    private buildLimit;
    /** 生成 INSERT VLAUES */
    private buildInsertValues;
    /** 生成 sql */
    buildRawSql(): string;
    /**
     * 新增列
     * @param field 字段名
     * @param type 类型
     * @param tableName 表名
     * @returns `string`
     */
    addColumn(field: string, type: DataType, tableName?: string): string;
    /**
     * 数据切片
     */
    dataSlice<T = any>(opt: {
        /** 需要切片数据 */
        datas: T[];
        /** 一份的最大长度 */
        onceMaxDataLength: number;
    }): T[][];
    /**
     * 执行 update when 语句(支持大数据量, 内部会做切分执行), 参考`$buildUpdateByWhen`
     */
    buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>): string[];
    /**
     * 执行 update when 语句, 这个方法最多一次只能更新999条数据
     * - 不然会报错 `sqlite3_prepare_v2 failure: Expression tree is too large (maximum depth 1000)`
     * - 请使用`updateByWhen`
     *
     * ```ts
     * const updateByWhenRes = await this.$buildUpdateByWhen({
     * 	datas: data,
     * 	fieldOpts: [
     * 		{
     * 			setField: "tidCode",
     * 			getWhenField() {
     * 				return "epcNum";
     * 			},
     * 			getWhenValue(row) {
     * 				return row.epc;
     * 			},
     * 			getThenValue(row) {
     * 				return row.tid;
     * 			}
     * 		},
     * 		{
     * 			setField: "scanDate",
     * 			getWhenField() {
     * 				return "epcNum";
     * 			},
     * 			getWhenValue(row) {
     * 				return row.epc;
     * 			},
     * 			getThenValue(row) {
     * 				return row.scanTime;
     * 			}
     * 		}
     * 	],
     * 	getExtraUpdateWhen: (updatas) => {
     * 		// const epcs = updatas.map(e => `"${e.epc}"`).join(", ");
     * 		// return `flag = CASE epcNum IN (${epcs}) THEN 2 END`;
     * 		return "flag = CASE WHEN 1=1 THEN 2 END";
     * 	},
     * 	getExtraWhere: (updatas) => {
     * 		// const epcs = updatas.map(e => `"${e.epc}"`).join(", ");
     * 		// return `epcNum IN (${epcs})`;
     *
     * 		return updatas.map((e) => `epcNum="${e.epc}"`).join(" OR ");
     * 	}
     * });
     * ```
     *
     * 内部生成并执行的 sql 参考如下:
     *
     * ```sql
     * UPDATE "xxx.db"
     *  SET tidCode = CASE
     *    WHEN epcNum="4400899522000294" THEN "E28011052000719490DF0AC0"
     *    WHEN epcNum="44008995HD006822" THEN "E280110520007B5A91060AC0"
     *    WHEN epcNum="44008995HD006875" THEN "E28011052000725A910B0AC0"
     *  END,
     *    scanDate = CASE
     *     WHEN epcNum="4400899522000294" THEN "2023-08-15 10:58:32"
     *     WHEN epcNum="44008995HD006822" THEN "2023-08-15 10:57:11"
     *     WHEN epcNum="44008995HD006875" THEN "2023-08-15 10:56:39"
     *  END,
     *    flag = CASE WHEN 1=1 THEN 2
     *  END
     *   WHERE epcNum="4400899522000294" OR epcNum="44008995HD006822" OR epcNum="44008995HD006875"
     * ```
     */
    private $buildUpdateByWhen;
    /**
     * 设置数据库版本
     */
    setVersion(version: number): string;
    /**
     * 获取数据库表信息
     */
    tableInfo(tableName?: string): string;
    findById(id: string | number, field?: string): string;
    selectAll(tableName?: string): string;
    deleteById(id: string | number, field?: string): string;
    deleteAll(tableName?: string): string;
    deleteTable(tableName?: string): string;
    /**
     * 构建 CREATE TABLE 语句
     */
    buildCreate(option: TableFieldsOption[]): string;
}
export default SqliteOrm;
